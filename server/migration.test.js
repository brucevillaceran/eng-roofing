import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createStore } from "./test-database.js";
import { createStore as openStore } from "./store.js";
import { seed } from "./seed.js";
import { hashPassword, verifyPassword } from "./auth.js";
import { migrateSqlite } from "../scripts/migrate-sqlite.js";
import { tables, children } from "./database-model.js";
const at = "2026-10-04T00:00:00.123Z";
function fixture(t, mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "eng-sqlite-import-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "source.sqlite"),
    s = seed();
  s.users[0].passwordHash = hashPassword("Synthetic-migration-password");
  for (const u of s.users) {
    u.active = true;
    u.sessionVersion = 2;
  }
  s.users[2].descriptor = Array.from({ length: 128 }, (_, i) => i / 1000);
  s.bookings[0].clientId = "USR-6";
  s.bookings[0].photos = ["data:image/png;base64,c3ludGhldGlj"];
  s.materials[0].history = [
    { at, price: null, unit: null, name: null, newPrice: 500, note: "Created" },
  ];
  s.attendance[0].corrections = [
    {
      at,
      actorId: "USR-1",
      previousHours: 7,
      hours: 8,
      reason: "Synthetic correction",
    },
  ];
  s.payroll = [
    {
      id: "PR-1",
      userId: "USR-3",
      from: "2026-10-01",
      to: "2026-10-04",
      attendanceIds: ["ATT-1"],
      days: 1,
      hours: 8,
      rate: 750,
      gross: 750,
      deductions: 10,
      net: 740,
      status: "Paid",
      createdAt: at,
      releasedAt: at,
      correctionReason: "Correction",
      adjustments: [
        {
          previousDeductions: 0,
          deductions: 10,
          reason: "Correction",
          actorId: "USR-1",
          at,
        },
      ],
    },
  ];
  s.payments[0].annotations = [
    { previousRemarks: "Initial", remarks: "Checked", actorId: "USR-1", at },
  ];
  s.projects[0].timeline.push({
    text: "Progress",
    at,
    actorId: "USR-2",
    progress: 65,
  });
  s.notifications[0].userId = "USR-1";
  s.emails = [
    {
      id: "EMAIL-1",
      to: "synthetic@example.test",
      subject: "Quotation",
      message: "Synthetic",
      path: "/track/test",
      createdAt: at,
      status: "Local preview",
    },
  ];
  mutate(s);
  const sqlite = new DatabaseSync(path);
  for (const table of tables) {
    sqlite.exec(`CREATE TABLE ${table}(id TEXT PRIMARY KEY,data TEXT)`);
    const insert = sqlite.prepare(`INSERT INTO ${table} VALUES(?,?)`);
    for (const row of s[table]) insert.run(row.id, JSON.stringify(row));
  }
  for (const c of children.slice(0, 3)) {
    const definition = { [c.parentKey]: "text", ...c.fields };
    const keys = Object.keys(definition);
    sqlite.exec(
      `CREATE TABLE ${c.table} (${keys.map((k) => `${k} ${definition[k] === "number" ? "REAL" : "TEXT"}`).join(",")})`,
    );
    const statement = sqlite.prepare(
      `INSERT INTO ${c.table} VALUES (${keys.map(() => "?").join(",")})`,
    );
    for (const parent of s[c.parent])
      for (const item of parent[c.property] || []) {
        const row = {
          [c.parentKey]: parent.id,
          ...(c.scalar ? { [c.scalar]: item } : item),
        };
        statement.run(...keys.map((k) => row[k]));
      }
  }
  sqlite.exec(
    "CREATE TABLE sessions(tokenHash TEXT PRIMARY KEY,userId TEXT,csrf TEXT,version INTEGER,expires INTEGER); CREATE TABLE login_attempts(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER); CREATE TABLE migrations(id TEXT PRIMARY KEY);",
  );
  sqlite
    .prepare("INSERT INTO sessions VALUES(?,?,?,?,?)")
    .run("a".repeat(64), "USR-1", "b".repeat(64), 2, Date.now() + 3600000);
  sqlite
    .prepare("INSERT INTO login_attempts VALUES(?,?,?)")
    .run("c".repeat(64), 3, Date.now() + 900000);
  sqlite.exec("INSERT INTO migrations VALUES('account-ownership-v1')");
  sqlite.close();
  return { path, state: s };
}
const digest = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
test("populated SQLite import preserves IDs, histories, money, media, passwords and sessions exactly", async (t) => {
  const { path, state } = fixture(t),
    before = digest(path),
    target = await createStore();
  const result = await migrateSqlite(path, target.testConfig);
  assert.equal(digest(path), before);
  assert.ok(readFileSync(result.backupPath).length);
  const saved = await target.read();
  for (const table of tables)
    assert.deepEqual(saved[table], state[table], table);
  assert.ok(
    verifyPassword("Synthetic-migration-password", saved.users[0].passwordHash),
  );
  assert.equal(
    (
      await target.db.query("SELECT COUNT(*) AS n FROM payroll_attendance")
    )[0][0].n,
    1,
  );
  assert.equal(
    (await target.db.query("SELECT COUNT(*) AS n FROM sessions"))[0][0].n,
    1,
  );
  assert.equal(
    (await target.db.query("SELECT count FROM login_attempts"))[0][0].count,
    3,
  );
  await assert.rejects(
    migrateSqlite(path, target.testConfig),
    /already been imported/,
  );
});
test("invalid legacy relationships and unknown fields roll back the entire import", async (t) => {
  for (const mutate of [
    (s) => (s.projects[0].quotationId = "missing"),
    (s) => (s.feedback[0].unmapped = "must not be discarded"),
  ]) {
    const { path } = fixture(t, mutate),
      target = await createStore();
    await assert.rejects(migrateSqlite(path, target.testConfig));
    const state = await target.read();
    assert.equal(state.users.length, 0);
    assert.equal(state.projects.length, 0);
    assert.equal(
      (await target.db.query("SELECT COUNT(*) AS n FROM migrations"))[0][0].n,
      0,
    );
  }
});
test("populated targets are refused without modifying either database", async (t) => {
  const { path } = fixture(t),
    target = await createStore();
  await target.transaction((s) =>
    s.users.push({
      id: "existing",
      name: "Existing",
      email: "existing@example.test",
      role: "Client",
    }),
  );
  const before = await target.read();
  await assert.rejects(
    migrateSqlite(path, target.testConfig),
    /contains business records/,
  );
  assert.deepEqual(await target.read(), before);
});
test("separate pools serialize mutations, reject stale snapshots and preserve failed transactions", async () => {
  const first = await createStore(),
    second = await openStore(first.testConfig);
  try {
    await Promise.all(
      Array.from({ length: 16 }, (_, i) =>
        (i % 2 ? first : second).transaction((s) => {
          s.settings[0].hoursPerDay += 1;
        }),
      ),
    );
    assert.equal((await first.read()).settings[0].hoursPerDay, 24);
    const stale = await first.read();
    await second.transaction((s) => {
      s.settings[0].name = "Newer";
    });
    stale.settings[0].name = "Stale";
    await assert.rejects(first.save(stale), /concurrently/);
    await assert.rejects(
      first.transaction((s) => {
        s.settings[0].name = "Partial";
        throw new Error("rollback");
      }),
      /rollback/,
    );
    assert.equal((await second.read()).settings[0].name, "Newer");
  } finally {
    await second.close();
  }
});

test("inconsistent legacy relationship tables abort before import", async (t) => {
  const { path } = fixture(t),
    target = await createStore();
  const sqlite = new DatabaseSync(path);
  sqlite.exec("UPDATE quotation_materials SET price=price+1");
  sqlite.close();
  await assert.rejects(
    migrateSqlite(path, target.testConfig),
    /disagrees with entity records/,
  );
  assert.equal((await target.read()).users.length, 0);
});
