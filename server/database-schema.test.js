import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPool, initializeSchema, checkSchema } from "./database.js";
import { requiredSchema } from "./database-schema.js";
import { createStore as fixture } from "./test-database.js";
import { createStore } from "./store.js";

async function emptyDatabase(t) {
  const database = `eng_roofing_test_${randomUUID().replaceAll("-", "")}`;
  const admin = createPool({ database: undefined });
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
  const db = createPool({ database });
  t.after(async () => {
    await db.end();
    try {
      await admin.query(`DROP DATABASE \`${database}\``);
    } finally {
      await admin.end();
    }
  });
  return { db, database };
}

test("schema covers every model, child and auth table, with working archive constraints", async (t) => {
  const { db } = await emptyDatabase(t);
  await assert.rejects(
    checkSchema(db),
    /missing table users.*missing table userpayrollarchive/,
  );
  await Promise.all([initializeSchema(db), initializeSchema(db)]);
  const schema = await checkSchema(db);
  assert.equal(schema.tables, 28);
  const [tables] = await db.query("SHOW TABLES");
  assert.deepEqual(
    tables.map((r) => Object.values(r)[0]).sort(),
    Object.keys(requiredSchema).sort(),
  );
  const [columns] = await db.query("SHOW COLUMNS FROM userpayrollarchive");
  const col = Object.fromEntries(columns.map((c) => [c.Field, c]));
  assert.equal(col.id.Key, "PRI");
  for (const name of [
    "id",
    "_position",
    "userId",
    "role",
    "archivedAt",
    "_fields",
  ])
    assert.equal(col[name].Null, "NO");
  for (const name of ["rate", "descriptor"])
    assert.equal(col[name].Null, "YES");
  assert.match(col.rate.Type, /double/);
  assert.match(col.archivedAt.Type, /datetime\(3\)/);
  await assert.rejects(
    db.execute(
      "INSERT INTO userpayrollarchive (id,_position,userId,role,archivedAt,_fields) VALUES ('orphan',0,'missing','Admin',NOW(3),'[]')",
    ),
    { code: "ER_NO_REFERENCED_ROW_2" },
  );
  await db.query(
    "INSERT INTO users (id,_position,_fields) VALUES ('owner',0,'[]')",
  );
  await db.query(
    "INSERT INTO userpayrollarchive (id,_position,userId,role,archivedAt,_fields) VALUES ('archive',0,'owner','Admin',NOW(3),'[]')",
  );
  await assert.rejects(db.query("DELETE FROM users WHERE id='owner'"), {
    code: "ER_ROW_IS_REFERENCED_2",
  });
  await assert.rejects(
    db.query(
      "UPDATE userpayrollarchive SET descriptor='not-json' WHERE id='archive'",
    ),
  );
  await db.query("UPDATE app_state SET revision=42 WHERE id=1");
  await initializeSchema(db);
  const [[state]] = await db.query("SELECT revision FROM app_state WHERE id=1");
  assert.equal(state.revision, 42);
});

test("startup upgrades a populated pre-archive database and preserves payroll, users and sessions", async () => {
  const store = await fixture(":memory:", { sample: true });
  await store.transaction((s) => {
    s.users.find((u) => u.role === "Foreman").descriptor = Array(128).fill(0.1);
    s.payroll.push({
      id: "historic-payroll",
      userId: s.users.find((u) => u.role === "Employee").id,
      from: "2026-10-01",
      to: "2026-10-02",
      days: 1,
      hours: 8,
      rate: 750,
      gross: 750,
      deductions: 50,
      net: 700,
      status: "Paid",
      attendanceIds: [],
      createdAt: "2026-10-02T10:00:00.000Z",
      releasedAt: "2026-10-02T12:00:00.000Z",
    });
  });
  const before = await store.read();
  await store.db.execute(
    "INSERT INTO sessions (tokenHash,userId,csrf,version,expires) VALUES (?,?,?,?,?)",
    ["a".repeat(64), before.users[0].id, "b".repeat(64), 0, Date.now() + 60000],
  );
  const [sessions] = await store.db.query("SELECT * FROM sessions");
  await store.db.query("DROP TABLE userpayrollarchive");
  await store.db.query("DROP TABLE login_attempts");
  await assert.rejects(
    checkSchema(store.db),
    /missing table userpayrollarchive.*missing table login_attempts/,
  );
  await store.close();
  const upgraded = await createStore(store.testConfig);
  try {
    await checkSchema(upgraded.db);
    const after = await upgraded.read();
    for (const key of Object.keys(before).filter(
      (k) => !["users", "userPayrollArchive"].includes(k),
    ))
      assert.deepEqual(after[key], before[key], `${key} history retained`);
    assert.deepEqual(
      after.users.map(({ rate, descriptor, ...u }) => u),
      before.users.map(({ rate, descriptor, ...u }) => u),
    );
    assert.deepEqual(
      (await upgraded.db.query("SELECT * FROM sessions"))[0],
      sessions,
    );
    const archive = after.userPayrollArchive.find((r) => r.role === "Foreman");
    assert.equal(archive.rate, 950);
    assert.deepEqual(archive.descriptor, Array(128).fill(0.1));
    await initializeSchema(upgraded.db);
    assert.deepEqual(await upgraded.read(), after);
  } finally {
    await upgraded.close();
  }
});

test("legacy mixed-case archive is renamed without losing rows; ambiguous names fail safely", async (t) => {
  const { db } = await emptyDatabase(t);
  await initializeSchema(db);
  await db.query(
    "INSERT INTO users (id,_position,_fields) VALUES ('owner',0,'[]')",
  );
  await db.query(
    "INSERT INTO userpayrollarchive (id,_position,userId,role,rate,descriptor,archivedAt,_fields) VALUES ('old',0,'owner','Foreman',950,'[0.1]',NOW(3),'[]')",
  );
  const [before] = await db.query("SELECT * FROM userpayrollarchive");
  const [[config]] = await db.query("SELECT @@lower_case_table_names AS mode");
  if (config.mode === 0) {
    await db.query("RENAME TABLE userpayrollarchive TO userPayrollArchive");
    await assert.rejects(checkSchema(db), /must be named userpayrollarchive/);
  }
  await initializeSchema(db);
  assert.deepEqual(
    (await db.query("SELECT * FROM userpayrollarchive"))[0],
    before,
  );
  await checkSchema(db);
  if (config.mode === 0) {
    await db.query("CREATE TABLE userPayrollArchive LIKE userpayrollarchive");
    await assert.rejects(initializeSchema(db), /ambiguous table names/);
    assert.deepEqual(
      (await db.query("SELECT * FROM userpayrollarchive"))[0],
      before,
    );
  }
});

test("check reports all missing tables/columns; upgrade refuses incompatible existing tables", async (t) => {
  const { db } = await emptyDatabase(t);
  await initializeSchema(db);
  await db.query("ALTER TABLE userpayrollarchive DROP COLUMN archivedAt");
  await db.query("DROP TABLE login_attempts");
  await assert.rejects(
    checkSchema(db),
    /missing column userpayrollarchive.archivedAt.*missing table login_attempts/,
  );
  await assert.rejects(
    initializeSchema(db),
    /missing column userpayrollarchive.archivedAt/,
  );
  const [tables] = await db.query("SHOW TABLES LIKE 'login_attempts'");
  assert.equal(
    tables.length,
    0,
    "preflight must refuse before partially changing an incompatible schema",
  );
});
