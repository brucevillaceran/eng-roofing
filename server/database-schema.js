import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { models, children, tableName, quote } from "./database-model.js";

// Model-driven inventory includes history/link tables and direct auth SQL.
export const requiredSchema = {
  ...Object.fromEntries(
    Object.entries(models).map(([name, fields]) => [
      tableName(name),
      ["id", "_position", ...Object.keys(fields), "_fields"],
    ]),
  ),
  ...Object.fromEntries(
    children.map((c) => [
      c.table,
      [c.parentKey, "_position", ...Object.keys(c.fields), "_fields"],
    ]),
  ),
  sessions: ["tokenHash", "userId", "csrf", "version", "expires"],
  login_attempts: ["key", "count", "expires"],
  migrations: ["id", "details"],
  app_state: ["id", "revision"],
};

async function inventory(connection) {
  const [[config]] = await connection.query(
    "SELECT DATABASE() AS databaseName, @@lower_case_table_names AS lowerCaseNames",
  );
  if (!config.databaseName) throw new Error("Select DB_NAME in .env");
  const [rows] = await connection.execute(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?",
    [config.databaseName],
  );
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.TABLE_NAME)) tables.set(row.TABLE_NAME, new Set());
    tables.get(row.TABLE_NAME).add(row.COLUMN_NAME.toLowerCase());
  }
  return { ...config, tables };
}
function matchingTables(info, name) {
  return [...info.tables.keys()].filter(
    (actual) => actual.toLowerCase() === name.toLowerCase(),
  );
}
function problems(
  info,
  { allowMissing = false, allowArchiveRename = false } = {},
) {
  const errors = [];
  for (const [table, columns] of Object.entries(requiredSchema)) {
    const matches = matchingTables(info, table);
    if (!matches.length) {
      if (!allowMissing) errors.push(`missing table ${table}`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(
        `ambiguous table names ${matches.join(" / ")}; preserve both and resolve the duplicate before retrying`,
      );
      continue;
    }
    const actual = matches[0];
    if (
      !info.lowerCaseNames &&
      actual !== table &&
      !(allowArchiveRename && table === "userpayrollarchive")
    )
      errors.push(`table ${actual} must be named ${table}`);
    for (const column of columns)
      if (!info.tables.get(actual).has(column.toLowerCase()))
        errors.push(`missing column ${actual}.${column}`);
  }
  return errors;
}
function assertSchema(errors) {
  if (errors.length)
    throw new Error(
      `Database schema is incomplete: ${errors.join("; ")}. Run npm run db:init; incompatible existing tables require an explicit schema repair, not a database reset`,
    );
}
export async function checkSchema(pool) {
  const connection = await pool.getConnection();
  try {
    const info = await inventory(connection);
    assertSchema(problems(info));
    const [[state]] = await connection.query(
      "SELECT revision FROM app_state WHERE id=1",
    );
    if (!state)
      throw new Error("Missing app_state revision row. Run npm run db:init");
    return {
      databaseName: info.databaseName,
      tables: Object.keys(requiredSchema).length,
    };
  } finally {
    connection.release();
  }
}
async function definitions() {
  const sql = await readFile(
    new URL("../database/schema.sql", import.meta.url),
    "utf8",
  );
  // This schema has only line comments, CREATE TABLEs and the app_state insert.
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const creates = new Map();
  for (const statement of statements) {
    const match = /^CREATE TABLE IF NOT EXISTS `([a-z_]+)`\s*\(/.exec(
      statement,
    );
    if (match) creates.set(match[1], statement);
    else if (!statement.startsWith("INSERT INTO app_state "))
      throw new Error("Unsupported statement in database/schema.sql");
  }
  const missing = Object.keys(requiredSchema).filter(
    (name) => !creates.has(name),
  );
  const extra = [...creates.keys()].filter((name) => !requiredSchema[name]);
  if (missing.length || extra.length)
    throw new Error(
      `Schema/model mismatch: missing ${missing.join(", ") || "none"}; unexpected ${extra.join(", ") || "none"}`,
    );
  return creates;
}
export async function initializeSchema(pool) {
  const creates = await definitions();
  const connection = await pool.getConnection();
  let lock;
  try {
    let info = await inventory(connection);
    lock = `eng-schema-${createHash("sha256").update(info.databaseName).digest("hex").slice(0, 48)}`;
    const [[result]] = await connection.execute(
      "SELECT GET_LOCK(?, 30) AS acquired",
      [lock],
    );
    if (Number(result.acquired) !== 1) {
      lock = undefined;
      throw new Error("Database schema upgrade is busy; retry startup shortly");
    }
    info = await inventory(connection);
    // DDL auto-commits: inspect existing tables before making any changes.
    assertSchema(
      problems(info, { allowMissing: true, allowArchiveRename: true }),
    );
    const [archive] = matchingTables(info, "userpayrollarchive");
    if (archive && !info.lowerCaseNames && archive !== "userpayrollarchive") {
      await connection.query(
        `RENAME TABLE ${quote(archive)} TO userpayrollarchive`,
      );
      info.tables.set("userpayrollarchive", info.tables.get(archive));
      info.tables.delete(archive);
    }
    // Only missing tables are created, in schema FK order. Existing rows,
    // columns, indexes and constraints are never overwritten or dropped.
    for (const [table, statement] of creates)
      if (!matchingTables(info, table).length)
        await connection.query(statement);
    assertSchema(problems(await inventory(connection)));
    const [[state]] = await connection.query(
      "SELECT revision FROM app_state WHERE id=1",
    );
    if (!state)
      await connection.query(
        "INSERT INTO app_state (id, revision) VALUES (1, 0) ON DUPLICATE KEY UPDATE id=id",
      );
  } finally {
    try {
      if (lock) await connection.execute("SELECT RELEASE_LOCK(?)", [lock]);
    } finally {
      connection.release();
    }
  }
}
