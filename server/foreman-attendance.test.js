import test from "node:test";
import { seed } from "./seed.js";
import assert from "node:assert/strict";
import { createStore as fixture } from "./test-database.js";
import { createApi } from "./api.js";
import { hashPassword } from "./auth.js";
import { initializeSchema } from "./database.js";
import { workDate, payrollHours } from "../shared/attendance.js";
const descriptor = Array(128).fill(0.1),
  password = "Synthetic-attendance-password";
async function setup(t) {
  const store = await fixture();
  await store.transaction((s) => {
    Object.assign(s, seed());
    s.attendance = [];
    s.payroll = [];
    for (const u of s.users) {
      u.passwordHash = hashPassword(password);
      u.active = true;
      u.sessionVersion = 0;
      if (u.role === "Employee") u.descriptor = descriptor;
    }
    s.users.push({
      id: "foreman-b",
      name: "Other Foreman",
      email: "other@foreman.test",
      role: "Foreman",
      active: true,
      sessionVersion: 0,
      passwordHash: hashPassword(password),
    });
    s.projects[0].foremanId = "";
    s.projects[0].employeeIds = [];
    s.projects[1].foremanId = "foreman-b";
    s.projects[1].employeeIds = ["USR-5"];
  });
  const server = createApi(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, identity, data) {
    const res = await fetch(base + path, {
      method: data ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        ...(identity
          ? { Cookie: identity.cookie, "X-CSRF-Token": identity.csrf }
          : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const identities = {};
  for (const id of ["USR-1", "USR-2", "USR-3", "USR-6", "foreman-b"]) {
    const u = (await store.read()).users.find((u) => u.id === id);
    const r = await request("/api/auth/login", null, {
      email: u.email,
      password,
    });
    assert.equal(r.status, 200);
    identities[id] = { cookie: r.cookie, csrf: r.body.csrf };
  }
  const action = async (id, action, data, expected = 200) => {
    const r = await request("/api/action", identities[id], { action, data });
    assert.equal(r.status, expected, JSON.stringify(r.body));
    return r.body;
  };
  await action("USR-1", "project", {
    id: "PRJ-001",
    name: "Attendance Project A",
    foremanId: "USR-2",
    employeeIds: ["USR-3", "USR-4"],
    start: "2020-01-01",
    end: "2099-12-31",
    status: "Ongoing",
  });
  const clock = {
    projectId: "PRJ-001",
    userId: "USR-3",
    operation: "timeIn",
    descriptor,
    latitude: 14.6,
    longitude: 121,
  };
  const state = async (id) =>
    (await request("/api/state", identities[id])).body;
  return { store, action, state, clock };
}

test("Foreman attendance API enforces all roles, assignments, face verification and explicit clock states", async (t) => {
  const { store, action, state, clock } = await setup(t);
  const view = await state("USR-2");
  assert.ok(view.projects.some((p) => p.id === "PRJ-001"));
  assert.ok(!view.projects.some((p) => p.id === "PRJ-002"));
  assert.ok(view.users.some((u) => u.id === "USR-3" && u.enrolled));
  assert.ok(
    view.users.every(
      (u) => !u.descriptor && (u.role !== "Employee" || u.rate === undefined),
    ),
  );
  for (const role of ["USR-1", "USR-3", "USR-6"])
    await action(role, "attendance", clock, 403);
  await action("foreman-b", "attendance", clock, 403);
  await action("USR-2", "attendance", { ...clock, projectId: "PRJ-002" }, 403);
  await action("USR-2", "attendance", { ...clock, userId: "USR-5" }, 403);
  await action("USR-2", "attendance", { ...clock, userId: "USR-2" }, 403);
  await action(
    "USR-2",
    "attendance",
    { ...clock, descriptor: Array(128).fill(0.8) },
    400,
  );
  await action(
    "USR-2",
    "attendance",
    { ...clock, operation: "timeOut", attendanceId: "missing" },
    400,
  );
  await action("USR-2", "attendance", { ...clock, operation: "timeOut" }, 400);
  await action("USR-2", "attendance", { ...clock, operation: "toggle" }, 400);
  await action("USR-2", "attendance", { ...clock, hours: 8 }, 400);
  await action("USR-2", "attendance", { ...clock, date: "2026-01-01" }, 400);
  await store.transaction((s) => {
    delete s.users.find((u) => u.id === "USR-4").descriptor;
  });
  await action("USR-2", "attendance", { ...clock, userId: "USR-4" }, 400);
  assert.equal((await store.read()).attendance.length, 0);
  await store.transaction((s) => {
    s.users.find((u) => u.id === "USR-4").descriptor = descriptor;
  });
  const a = await action("USR-2", "attendance", clock);
  assert.equal(a.userId, "USR-3");
  assert.equal(a.projectId, "PRJ-001");
  assert.equal(a.foremanId, "USR-2");
  assert.equal(a.date, workDate());
  assert.equal(a.verified, true);
  assert.equal(a.hours, 0);
  assert.equal(a.createdAt, a.checkIn);
  assert.ok(!a.descriptor && !a.photo);
  await action("USR-2", "attendance", clock, 400); // Duplicate in must not toggle to out.
  await action(
    "USR-2",
    "attendance",
    { ...clock, operation: "timeOut", attendanceId: a.id, userId: "USR-4" },
    403,
  );
  await action(
    "USR-2",
    "attendance",
    {
      ...clock,
      operation: "timeOut",
      attendanceId: a.id,
      descriptor: Array(128).fill(0.9),
    },
    400,
  );
  await action(
    "USR-1",
    "attendanceUpdate",
    { id: a.id, hours: 7, reason: "Override" },
    400,
  );
  await action(
    "USR-1",
    "payroll",
    { userId: "USR-3", from: workDate(), to: workDate() },
    400,
  );
  await store.transaction((s) => {
    s.attendance[0].checkIn = new Date(Date.now() + 3600000).toISOString();
  });
  await action(
    "USR-2",
    "attendance",
    { ...clock, operation: "timeOut", attendanceId: a.id },
    400,
  );
  assert.equal((await store.read()).attendance[0].checkOut, null);
  await store.transaction((s) => {
    s.attendance[0].checkIn = new Date(Date.now() - 9 * 3600000).toISOString();
  });
  const out = await action("USR-2", "attendance", {
    ...clock,
    operation: "timeOut",
    attendanceId: a.id,
  });
  assert.equal(out.hours, 9);
  assert.equal(out.checkOutForemanId, "USR-2");
  assert.equal(out.updatedAt, out.checkOut);
  await action(
    "USR-2",
    "attendance",
    { ...clock, operation: "timeOut", attendanceId: a.id },
    400,
  );
  await action("USR-2", "attendance", clock, 400);
  assert.equal((await state("USR-2")).attendance.length, 1);
  assert.equal((await state("foreman-b")).attendance.length, 0);
  assert.equal((await state("USR-3")).attendance.length, 1);
  assert.equal((await state("USR-6")).attendance.length, 0);
  // Stored hours (including old Admin corrections) are not the payroll authority.
  await store.transaction((s) => {
    s.attendance[0].hours = 123;
  });
  await action("USR-1", "payroll", {
    userId: "USR-3",
    from: workDate(),
    to: workDate(),
    deductions: 50,
  });
  const p = (await store.read()).payroll[0];
  assert.equal(p.workedHours, 9);
  assert.equal(p.hours, 8);
  assert.equal(p.rate, 750);
  assert.equal(p.gross, 750);
  assert.equal(p.net, 700);
  assert.deepEqual(p.attendanceIds, [a.id]);
  assert.equal((await state("USR-1")).payroll.length, 1);
  assert.equal((await state("USR-3")).payroll.length, 1);
  assert.equal((await state("USR-2")).payroll.length, 0);
  assert.equal((await state("USR-6")).payroll.length, 0);
});

test("parallel Time In/Out retries produce one session and assignments are rechecked", async (t) => {
  const { store, action, clock } = await setup(t);
  // The API serializes state-changing operations in the existing DB transaction.
  const results = await Promise.allSettled([
    action("USR-2", "attendance", clock),
    action("USR-2", "attendance", clock),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  let a = (await store.read()).attendance[0];
  assert.equal((await store.read()).attendance.length, 1);
  assert.equal(a.checkOut, null);
  for (const r of results.filter((r) => r.status === "rejected"))
    assert.equal(r.reason.actual, 400);
  await action("USR-1", "project", {
    id: "PRJ-002",
    foremanId: "USR-2",
    employeeIds: ["USR-3"],
    start: "2020-01-01",
    end: "2099-12-31",
    status: "Ongoing",
  });
  await action("USR-2", "attendance", { ...clock, projectId: "PRJ-002" }, 400);
  await action(
    "USR-2",
    "attendance",
    {
      ...clock,
      projectId: "PRJ-002",
      operation: "timeOut",
      attendanceId: a.id,
    },
    403,
  );
  await action(
    "USR-1",
    "project",
    {
      id: "PRJ-001",
      foremanId: "USR-2",
      employeeIds: ["USR-4"],
      status: "On Hold",
    },
    400,
  );
  await store.transaction((s) => {
    s.projects[0].foremanId = "foreman-b";
    s.attendance[0].checkIn = new Date(Date.now() - 2 * 3600000).toISOString();
  });
  const out = { ...clock, operation: "timeOut", attendanceId: a.id };
  await action("USR-2", "attendance", out, 403);
  const retries = await Promise.allSettled([
    action("foreman-b", "attendance", out),
    action("foreman-b", "attendance", out),
  ]);
  assert.equal(retries.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of retries.filter((r) => r.status === "rejected"))
    assert.equal(r.reason.actual, 400);
  a = (await store.read()).attendance[0];
  assert.equal(a.hours, 2);
  assert.equal(a.foremanId, "USR-2");
  assert.equal(a.checkOutForemanId, "foreman-b");
});

test("payroll retains daily cap across project sessions and rejects overlapping clocks", () => {
  const a = {
    date: "2026-10-01",
    checkIn: "2026-10-01T00:00:00Z",
    checkOut: "2026-10-01T05:00:00Z",
  };
  const b = {
    date: a.date,
    checkIn: "2026-10-01T06:00:00Z",
    checkOut: "2026-10-01T10:00:00Z",
  };
  assert.deepEqual(payrollHours([a, b]), { workedHours: 9, hours: 8 });
  assert.throws(
    () => payrollHours([a, { ...b, checkIn: "2026-10-01T04:00:00Z" }]),
    /Overlapping/,
  );
});

test("attendance/payroll schema upgrade is additive, repeatable and preserves historical records", async () => {
  const store = await fixture(":memory:", { sample: true });
  await store.transaction((s) =>
    s.payroll.push({
      id: "legacy-paid",
      userId: "USR-3",
      from: "2026-10-02",
      to: "2026-10-02",
      hours: 8,
      days: 1,
      rate: 750,
      gross: 750,
      deductions: 0,
      net: 750,
      status: "Paid",
      attendanceIds: ["ATT-1"],
    }),
  );
  const before = await store.read();
  await store.db.query(
    "ALTER TABLE attendance DROP FOREIGN KEY attendance_in_foreman, DROP FOREIGN KEY attendance_out_foreman, DROP COLUMN foremanId, DROP COLUMN checkOutForemanId, DROP COLUMN createdAt, DROP COLUMN updatedAt",
  );
  await store.db.query("ALTER TABLE payroll DROP COLUMN workedHours");
  await initializeSchema(store.db);
  await initializeSchema(store.db);
  assert.deepEqual(await store.read(), before);
  const [columns] = await store.db.query("SHOW COLUMNS FROM attendance");
  for (const field of [
    "foremanId",
    "checkOutForemanId",
    "createdAt",
    "updatedAt",
  ])
    assert.equal(columns.find((c) => c.Field === field).Null, "YES");
  await assert.rejects(
    store.db.query(
      "UPDATE attendance SET foremanId='missing' WHERE id='ATT-1'",
    ),
    { code: "ER_NO_REFERENCED_ROW_2" },
  );
});
