import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seed } from "./seed.js";
const tables = [
  "users",
  "bookings",
  "inspections",
  "quotations",
  "projects",
  "tasks",
  "materials",
  "usage",
  "attendance",
  "payroll",
  "payments",
  "feedback",
  "notifications",
  "emails",
  "settings",
];
const references = {
  bookings: { clientId: "users" },
  inspections: { bookingId: "bookings", foremanId: "users" },
  quotations: { bookingId: "bookings", inspectionId: "inspections" },
  projects: {
    bookingId: "bookings",
    quotationId: "quotations",
    foremanId: "users",
  },
  tasks: { projectId: "projects", assigneeId: "users" },
  usage: { projectId: "projects", materialId: "materials" },
  attendance: { projectId: "projects", userId: "users" },
  payroll: { userId: "users" },
  payments: { projectId: "projects" },
  feedback: { projectId: "projects" },
};
export function createStore(
  path = "data/eng-roofing.sqlite",
  { sample = false } = {},
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL;");
  for (const t of tables)
    db.exec(
      `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)))`,
    );
  for (const [table, fields] of Object.entries(references)) {
    const existing = db
      .prepare(`PRAGMA table_xinfo(${table})`)
      .all()
      .map((c) => c.name);
    for (const [field, target] of Object.entries(fields))
      if (!existing.includes(field))
        db.exec(
          `ALTER TABLE ${table} ADD COLUMN ${field} TEXT GENERATED ALWAYS AS (nullif(json_extract(data, '$.${field}'), '')) VIRTUAL REFERENCES ${target}(id) DEFERRABLE INITIALLY DEFERRED`,
        );
  }
  db.exec(`CREATE TABLE IF NOT EXISTS quotation_materials (quotationId TEXT NOT NULL REFERENCES quotations(id) DEFERRABLE INITIALLY DEFERRED, materialId TEXT NOT NULL REFERENCES materials(id) DEFERRABLE INITIALLY DEFERRED, name TEXT NOT NULL, unit TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity>0), price REAL NOT NULL CHECK(price>=0), PRIMARY KEY(quotationId,materialId));
 CREATE TABLE IF NOT EXISTS project_employees (projectId TEXT NOT NULL REFERENCES projects(id) DEFERRABLE INITIALLY DEFERRED, userId TEXT NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED, PRIMARY KEY(projectId,userId));
 CREATE TABLE IF NOT EXISTS payroll_attendance (payrollId TEXT NOT NULL REFERENCES payroll(id) DEFERRABLE INITIALLY DEFERRED, attendanceId TEXT NOT NULL UNIQUE REFERENCES attendance(id) DEFERRABLE INITIALLY DEFERRED, PRIMARY KEY(payrollId,attendanceId));
 PRAGMA foreign_keys=ON;`);
  const read = () =>
    Object.fromEntries(
      tables.map((t) => [
        t,
        db
          .prepare(`SELECT data FROM ${t} ORDER BY rowid`)
          .all()
          .map((r) => JSON.parse(r.data)),
      ]),
    );
  const save = (s) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const t of [
        "quotation_materials",
        "project_employees",
        "payroll_attendance",
        ...tables,
      ])
        db.exec(`DELETE FROM ${t}`);
      for (const t of tables) {
        const insert = db.prepare(`INSERT INTO ${t}(id,data) VALUES(?,?)`);
        for (const r of s[t]) insert.run(r.id, JSON.stringify(r));
      }
      const line = db.prepare(
        "INSERT INTO quotation_materials VALUES(?,?,?,?,?,?)",
      );
      for (const q of s.quotations)
        for (const m of q.items)
          line.run(q.id, m.materialId, m.name, m.unit, m.quantity, m.price);
      const assignment = db.prepare(
        "INSERT INTO project_employees VALUES(?,?)",
      );
      for (const p of s.projects)
        for (const u of p.employeeIds) assignment.run(p.id, u);
      const worked = db.prepare("INSERT INTO payroll_attendance VALUES(?,?)");
      for (const p of s.payroll)
        for (const a of p.attendanceIds) worked.run(p.id, a);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL, csrf TEXT NOT NULL, version INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY);`);
  if (!db.prepare("SELECT id FROM settings LIMIT 1").get()) {
    const existing = read();
    const initial =
      sample && tables.every((t) => existing[t].length === 0)
        ? seed()
        : existing;
    if (!initial.settings.length)
      initial.settings = [
        {
          id: "company",
          name: "ENG Roofing Supply & Installation Services",
          hoursPerDay: 8,
          currency: "PHP",
          payrollNote:
            "Daily rate prorated by verified hours, capped at eight hours per day. Enter approved deductions.",
        },
      ];
    save(initial);
  }
  // Link legacy bookings only to existing, unambiguous client accounts.
  const current = read();
  for (const u of current.users) {
    u.active ??= true;
    u.sessionVersion ??= 0;
  }
  const migrateOwnership = !db
    .prepare("SELECT id FROM migrations WHERE id=?")
    .get("account-ownership-v1");
  for (const b of migrateOwnership ? current.bookings : []) {
    if (!b.clientId) {
      const matches = current.users.filter(
        (u) =>
          u.role === "Client" &&
          u.email.toLowerCase() === b.email.toLowerCase(),
      );
      if (matches.length === 1) b.clientId = matches[0].id;
    }
  }
  // Legacy broadcast notifications have no trustworthy private recipient.
  current.notifications = current.notifications.filter((n) => n.userId);
  save(current);
  if (migrateOwnership)
    db.prepare("INSERT INTO migrations VALUES(?)").run("account-ownership-v1");
  return { read, save, db, close: () => db.close() };
}
