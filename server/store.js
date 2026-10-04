import { createPool } from "./database.js";
import {
  models,
  children,
  tables,
  quote as q,
  encode,
  decode,
  defaultSettings,
} from "./database-model.js";
const revision = Symbol("database revision");
export async function createStore(config = {}) {
  const db = createPool(config);
  try {
    await db.query("SELECT revision FROM app_state WHERE id=1");
  } catch (error) {
    await db.end();
    throw new Error(
      "Database unavailable or uninitialized. Check .env and run npm run db:init.",
      { cause: error },
    );
  }
  async function readFrom(connection) {
    const [[version]] = await connection.query(
      "SELECT revision FROM app_state WHERE id=1",
    );
    const state = {};
    for (const table of tables) {
      const [rows] = await connection.query(
        `SELECT * FROM ${q(table)} ORDER BY _position`,
      );
      state[table] = rows.map((row) => decode(row, models[table]));
    }
    for (const c of children) {
      const [rows] = await connection.query(
        `SELECT * FROM ${q(c.table)} ORDER BY _position`,
      );
      const grouped = new Map();
      for (const row of rows) {
        const value = decode(row, c.fields);
        if (!grouped.has(row[c.parentKey])) grouped.set(row[c.parentKey], []);
        grouped.get(row[c.parentKey]).push(c.scalar ? value[c.scalar] : value);
      }
      // Preserve absent legacy collection properties as well as empty arrays.
      const [parents] = await connection.query(
        `SELECT id, _fields FROM ${q(c.parent)}`,
      );
      const present = new Set(
        parents
          .filter((row) =>
            (typeof row._fields === "string"
              ? JSON.parse(row._fields)
              : row._fields
            ).includes(c.property),
          )
          .map((row) => row.id),
      );
      for (const parent of state[c.parent])
        if (present.has(parent.id))
          parent[c.property] = grouped.get(parent.id) || [];
    }
    Object.defineProperty(state, revision, { value: Number(version.revision) });
    return state;
  }
  async function writeTo(connection, state, before) {
    for (const table of tables) {
      if (!Array.isArray(state[table]))
        throw new Error(`Missing collection: ${table}`);
      const ids = new Set();
      for (const row of state[table]) {
        if (ids.has(row.id)) throw new Error(`Duplicate ${table} ID`);
        ids.add(row.id);
      }
      if (before[table].some((row) => !ids.has(row.id)))
        throw new Error(`Historical ${table} records cannot be deleted.`);
    }
    for (const table of tables) {
      const def = models[table],
        previous = new Map(before[table].map((row, i) => [row.id, { row, i }]));
      const cols = ["id", "_position", ...Object.keys(def), "_fields"];
      for (const [position, row] of state[table].entries()) {
        const old = previous.get(row.id);
        if (
          old?.i === position &&
          JSON.stringify(old.row) === JSON.stringify(row)
        )
          continue;
        const values = [
          row.id,
          position,
          ...encode(
            row,
            def,
            children.filter((c) => c.parent === table).map((c) => c.property),
          ),
        ];
        if (old)
          await connection.execute(
            `UPDATE ${q(table)} SET ${cols
              .slice(1)
              .map((k) => `${q(k)}=?`)
              .join(",")} WHERE id=?`,
            [...values.slice(1), row.id],
          );
        else
          await connection.execute(
            `INSERT INTO ${q(table)} (${cols.map(q).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
            values,
          );
      }
    }
    for (const c of children) {
      const previous = new Map(before[c.parent].map((row) => [row.id, row]));
      for (const parent of state[c.parent]) {
        if (
          JSON.stringify(previous.get(parent.id)?.[c.property]) ===
          JSON.stringify(parent[c.property])
        )
          continue;
        await connection.execute(
          `DELETE FROM ${q(c.table)} WHERE ${q(c.parentKey)}=?`,
          [parent.id],
        );
        const cols = [
          c.parentKey,
          "_position",
          ...Object.keys(c.fields),
          "_fields",
        ];
        for (const [position, item] of (parent[c.property] || []).entries()) {
          const row = c.scalar ? { [c.scalar]: item } : item;
          await connection.execute(
            `INSERT INTO ${q(c.table)} (${cols.map(q).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
            [parent.id, position, ...encode(row, c.fields)],
          );
        }
      }
    }
    await connection.query(
      "UPDATE app_state SET revision=revision+1 WHERE id=1",
    );
  }
  async function transaction(callback, afterWrite) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "SELECT revision FROM app_state WHERE id=1 FOR UPDATE",
      );
      const state = await readFrom(connection),
        before = structuredClone(state);
      let result = await callback(state, connection);
      await writeTo(connection, state, before);
      if (afterWrite) result = await afterWrite(result, connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async function read() {
    const connection = await db.getConnection();
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.beginTransaction();
      const state = await readFrom(connection);
      await connection.commit();
      return state;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async function save(state) {
    return transaction((current) => {
      if (state[revision] !== current[revision])
        throw new Error("Records changed concurrently. Reload and retry.");
      for (const table of tables) current[table] = state[table];
    });
  }
  try {
    await transaction((state) => {
      if (!state.settings.length) state.settings.push({ ...defaultSettings });
    });
  } catch (error) {
    await db.end();
    throw error;
  }
  let closing;
  return {
    db,
    read,
    readFrom,
    save,
    transaction,
    close: () => (closing ||= db.end()),
  };
}
