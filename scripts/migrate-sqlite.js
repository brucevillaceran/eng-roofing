// Offline, one-time importer. This is the only production tool that reads SQLite.
import { DatabaseSync, backup } from "node:sqlite";
import { chmod, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createStore } from "../server/store.js";
import {
  tables,
  children,
  defaultSettings,
  quote,
} from "../server/database-model.js";

export async function migrateSqlite(sourcePath, config = {}) {
  // Stop all old/new application writers before running this operator tool.
  const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
  const backupPath = resolve(`${sourcePath}.backup-${Date.now()}.sqlite`);
  let snapshot, store;
  try {
    await backup(source, backupPath);
    await chmod(backupPath, 0o600);
    snapshot = new DatabaseSync(backupPath, { readOnly: true });
    const checksum = createHash("sha256")
      .update(await readFile(backupPath))
      .digest("hex");
    const present = new Set(
      snapshot
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => r.name),
    );
    const supported = new Set([
      ...tables,
      "quotation_materials",
      "project_employees",
      "payroll_attendance",
      "sessions",
      "login_attempts",
      "migrations",
      "sqlite_sequence",
    ]);
    for (const name of present)
      if (!supported.has(name))
        throw new Error(
          `Unrecognized SQLite table ${name}; inspect before migrating.`,
        );
    const state = Object.fromEntries(
      tables.map((t) => [
        t,
        present.has(t)
          ? snapshot
              .prepare(`SELECT data FROM ${quote(t)} ORDER BY rowid`)
              .all()
              .map((r) => JSON.parse(r.data))
          : [],
      ]),
    );
    const auth = Object.fromEntries(
      ["sessions", "login_attempts", "migrations"].map((t) => [
        t,
        present.has(t)
          ? snapshot.prepare(`SELECT * FROM ${quote(t)}`).all()
          : [],
      ]),
    );
    // SQLite had redundant normalized links. Disagreement must be investigated,
    // not silently resolved by choosing one representation.
    for (const c of children.slice(0, 3))
      if (present.has(c.table)) {
        const actual = snapshot
          .prepare(`SELECT * FROM ${quote(c.table)}`)
          .all()
          .map((row) => ({ ...row }));
        const expected = state[c.parent].flatMap((parent) =>
          (parent[c.property] || []).map((item) => ({
            [c.parentKey]: parent.id,
            ...(c.scalar ? { [c.scalar]: item } : item),
          })),
        );
        const sort = (rows) =>
          rows.sort((a, b) =>
            JSON.stringify(Object.values(a)).localeCompare(
              JSON.stringify(Object.values(b)),
            ),
          );
        const keys = [c.parentKey, ...Object.keys(c.fields)];
        const canonical = (rows) =>
          sort(
            rows.map((row) =>
              Object.fromEntries(keys.map((key) => [key, row[key]])),
            ),
          );
        if (!isDeepStrictEqual(canonical(actual), canonical(expected)))
          throw new Error(
            `SQLite ${c.table} disagrees with entity records; resolve before importing.`,
          );
      }
    for (const user of state.users) {
      user.active ??= true;
      user.sessionVersion ??= 0;
    }
    if (!auth.migrations.some((m) => m.id === "account-ownership-v1")) {
      for (const b of state.bookings)
        if (!b.clientId) {
          const matches = state.users.filter(
            (u) =>
              u.role === "Client" &&
              u.email?.toLowerCase() === b.email?.toLowerCase(),
          );
          if (matches.length === 1) b.clientId = matches[0].id;
        }
      auth.migrations.push({ id: "account-ownership-v1" });
    }
    if (!state.settings.length) state.settings = [{ ...defaultSettings }];
    store = await createStore(config);
    const counts = Object.fromEntries(tables.map((t) => [t, state[t].length]));
    await store.transaction(
      async (current, connection) => {
        const [[marker]] = await connection.execute(
          "SELECT id FROM migrations WHERE id=?",
          ["sqlite-import-v1"],
        );
        if (marker)
          throw new Error(
            "SQLite has already been imported into this database. Use a separate empty database for another migration.",
          );
        if (tables.some((t) => t !== "settings" && current[t].length))
          throw new Error(
            "Target contains business records; refusing to merge or overwrite. Use an empty database.",
          );
        if (
          current.settings.length &&
          !isDeepStrictEqual(current.settings, [defaultSettings])
        )
          throw new Error(
            "Target has customized settings; refusing to overwrite.",
          );
        for (const table of ["sessions", "login_attempts", "migrations"]) {
          const [[r]] = await connection.query(
            `SELECT COUNT(*) AS count FROM ${quote(table)}`,
          );
          if (r.count) throw new Error(`Target ${table} is not empty.`);
        }
        for (const table of tables) current[table] = state[table];
        return counts;
      },
      async (result, connection) => {
        for (const session of auth.sessions)
          await connection.execute(
            "INSERT INTO sessions (tokenHash,userId,csrf,version,expires) VALUES(?,?,?,?,?)",
            [
              session.tokenHash,
              session.userId,
              session.csrf,
              session.version,
              session.expires,
            ],
          );
        for (const attempt of auth.login_attempts)
          await connection.execute(
            "INSERT INTO login_attempts (`key`,count,expires) VALUES(?,?,?)",
            [attempt.key, attempt.count, attempt.expires],
          );
        for (const migration of auth.migrations)
          await connection.execute("INSERT INTO migrations (id) VALUES(?)", [
            migration.id,
          ]);
        const persisted = await store.readFrom(connection);
        for (const table of tables)
          if (!isDeepStrictEqual(persisted[table], state[table]))
            throw new Error(
              `Verification failed for ${table}; import rolled back.`,
            );
        for (const table of ["sessions", "login_attempts"]) {
          const [rows] = await connection.query(
            `SELECT * FROM ${quote(table)}`,
          );
          const key = table === "sessions" ? "tokenHash" : "key";
          const order = (a) => a.sort((a, b) => a[key].localeCompare(b[key]));
          if (
            !isDeepStrictEqual(
              order(rows.map((r) => ({ ...r }))),
              order(auth[table].map((r) => ({ ...r }))),
            )
          )
            throw new Error(`Verification failed for ${table}.`);
        }
        await connection.execute(
          "INSERT INTO migrations (id,details) VALUES (?,?)",
          [
            "sqlite-import-v1",
            JSON.stringify({
              sourceSha256: checksum,
              counts,
              importedAt: new Date().toISOString(),
            }),
          ],
        );
        return result;
      },
    );
    return { counts, backupPath };
  } finally {
    snapshot?.close();
    source.close();
    if (store) await store.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = await migrateSqlite(
      process.argv[2] || "data/eng-roofing.sqlite",
    );
    console.log("Import committed and verified:", result.counts);
    console.log(
      "SQLite source retained. Consistent backup:",
      result.backupPath,
    );
  } catch (error) {
    console.error(
      `Import failed; source retained and import transaction rolled back: ${error.code || error.message}`,
    );
    process.exitCode = 1;
  }
}
