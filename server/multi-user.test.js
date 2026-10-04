import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./store.js";
import { createApi } from "./api.js";
import { hashPassword, verifyPassword } from "./auth.js";
import { apply } from "./domain.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const password = "Synthetic-test-password-2026";
async function setup(t, path = ":memory:") {
  const store = createStore(path);
  const state = store.read();
  state.users.push({
    id: "admin",
    name: "Test Admin",
    email: "admin@example.test",
    contact: "000",
    role: "Admin",
    active: true,
    sessionVersion: 0,
    passwordHash: hashPassword(password),
    rate: 0,
  });
  store.save(state);
  const server = createApi(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const request = async (
    path,
    {
      method = "GET",
      data,
      identity,
      csrf = true,
      origin = base,
      extra = {},
    } = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(method === "GET"
          ? {}
          : { "Content-Type": "application/json", Origin: origin }),
        ...(identity
          ? {
              Cookie: identity.cookie,
              ...(csrf ? { "X-CSRF-Token": identity.csrf } : {}),
            }
          : {}),
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await response.json();
    return {
      status: response.status,
      body,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      headers: response.headers,
    };
  };
  const login = async (email) => {
    const r = await request("/api/auth/login", {
      method: "POST",
      data: { email, password },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { cookie: r.cookie, csrf: r.body.csrf, user: r.body.user };
  };
  const action = async (identity, action, data, status = 200) => {
    const r = await request("/api/action", {
      method: "POST",
      identity,
      data: { action, data },
    });
    assert.equal(r.status, status, `${action}: ${JSON.stringify(r.body)}`);
    return r.body;
  };
  const admin = await login("admin@example.test");
  return { store, request, login, action, admin, server, base };
}
async function accounts(env) {
  for (const [name, role] of [
    ["foreman", "Foreman"],
    ["foreman2", "Foreman"],
    ["employee", "Employee"],
    ["employee2", "Employee"],
    ["client", "Client"],
    ["client2", "Client"],
  ]) {
    await env.action(env.admin, "user", {
      name,
      role,
      email: `${name}@example.test`,
      contact: "000",
      password,
      active: "Active",
      rate: 800,
    });
  }
  const identities = {};
  for (const name of [
    "foreman",
    "foreman2",
    "employee",
    "employee2",
    "client",
    "client2",
  ])
    identities[name] = await env.login(`${name}@example.test`);
  return identities;
}
const booking = {
  phone: "000",
  address: "Synthetic site",
  date: "2099-10-10",
  time: "09:00",
  service: "Roof Replacement",
  type: "Residential",
  description: "Roof repair",
};
async function project(env, users) {
  const b = await env.action(users.client, "book", {
    ...booking,
    clientId: users.client2.user.id,
    email: users.client2.user.email,
  });
  await env.action(env.admin, "booking", {
    id: b.id,
    status: "For Inspection",
    foremanId: users.foreman.user.id,
  });
  const i = env.store.read().inspections.find((i) => i.bookingId === b.id);
  await env.action(users.foreman, "inspection", {
    id: i.id,
    date: booking.date,
    area: 100,
    linear: 30,
    sections: 2,
    profile: "Rib-Type / Ribbed",
    complexity: "Simple",
    condition: "Damaged",
    notes: "Private survey note",
    clientNotes: "Roof requires replacement",
  });
  await env.action(env.admin, "material", {
    name: "Roofing sheet",
    category: "Roofing Sheet",
    unit: "SQM",
    price: 500,
    thickness: "0.4 mm",
    profile: "Rib-Type / Ribbed",
    active: "Active",
  });
  const material = env.store.read().materials[0];
  await env.action(users.foreman, "estimate", {
    inspectionId: i.id,
    items: [{ materialId: material.id, quantity: 100 }],
    charges: 5000,
  });
  const q = env.store.read().quotations[0];
  await env.action(env.admin, "finalize", { id: q.id, downpayment: 10000 });
  await env.action(
    users.client2,
    "quoteDecision",
    { id: q.id, token: b.token, status: "Approved" },
    403,
  );
  await env.action(users.client, "quoteDecision", {
    id: q.id,
    token: b.token,
    status: "Approved",
  });
  const p = env.store.read().projects[0];
  await env.action(env.admin, "project", {
    id: p.id,
    foremanId: users.foreman.user.id,
    employeeIds: [users.employee.user.id],
    start: "2020-01-01",
    end: "2099-12-31",
    status: "Scheduled",
  });
  await env.action(env.admin, "payment", {
    projectId: p.id,
    amount: 10000,
    method: "Cash",
    date: "2026-10-04",
    reference: "SYNTHETIC-1",
  });
  await env.action(env.admin, "project", {
    id: p.id,
    foremanId: users.foreman.user.id,
    employeeIds: [users.employee.user.id],
    start: "2020-01-01",
    end: "2099-12-31",
    status: "Ongoing",
  });
  return { b, i, q, p, material };
}

test("empty database, hashed credentials, registration, sessions, CSRF and logout", async (t) => {
  const env = await setup(t);
  assert.equal(env.store.read().projects.length, 0);
  assert.equal(env.store.read().materials.length, 0);
  assert.ok(verifyPassword(password, env.store.read().users[0].passwordHash));
  assert.equal(
    verifyPassword("wrong", env.store.read().users[0].passwordHash),
    false,
  );
  assert.equal(
    (await env.request("/api/state", { extra: { "x-demo-user": "admin" } }))
      .status,
    401,
  );
  assert.equal((await env.request("/api/personnel/admin")).status, 401);
  assert.equal(
    (
      await env.request("/api/auth/login", {
        method: "POST",
        data: { email: "admin@example.test", password: "wrong" },
      })
    ).status,
    401,
  );
  const registered = await env.request("/api/auth/register", {
    method: "POST",
    data: {
      name: "Registered Client",
      contact: "000",
      email: "NEW@EXAMPLE.TEST",
      password,
      role: "Admin",
      active: false,
    },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.role, "Client");
  assert.equal(registered.body.user.active, true);
  assert.equal(registered.body.user.email, "new@example.test");
  assert.equal(registered.body.user.passwordHash, undefined);
  assert.match(registered.headers.get("set-cookie"), /HttpOnly/);
  assert.match(registered.headers.get("set-cookie"), /SameSite=Strict/);
  const identity = { cookie: registered.cookie, csrf: registered.body.csrf };
  assert.equal(
    (
      await env.request("/api/action", {
        method: "POST",
        identity,
        csrf: false,
        data: { action: "book", data: booking },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await env.request("/api/action", {
        method: "POST",
        identity,
        origin: "https://evil.example",
        data: { action: "book", data: booking },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await env.request("/api/auth/register", {
        method: "POST",
        data: { name: "Duplicate", email: "new@example.test", password },
      })
    ).status,
    400,
  );
  await env.action(identity, "book", booking);
  await env.request("/api/auth/logout", { method: "POST", identity });
  assert.equal((await env.request("/api/state", { identity })).status, 401);
  assert.equal(
    (await env.request("/api/state", { identity: env.admin })).status,
    200,
  );
});

test("multi-user end-to-end workflow, isolation, notifications, attendance and payroll", async (t) => {
  const env = await setup(t),
    users = await accounts(env),
    { b, i, p, material } = await project(env, users);
  await env.action(users.client2, "book", booking);
  const own = async (identity) =>
    (await env.request("/api/state", { identity })).body;
  const clientState = await own(users.client);
  assert.equal(clientState.bookings.length, 1);
  assert.equal(clientState.bookings[0].clientId, users.client.user.id);
  assert.equal(clientState.inspections[0].notes, "Roof requires replacement");
  assert.equal(
    JSON.stringify(clientState).includes("Private survey note"),
    false,
  );
  assert.equal(clientState.projects.length, 1);
  assert.equal(clientState.payments.length, 1);
  assert.equal((await own(users.client2)).projects.length, 0);
  assert.equal(
    (await env.request(`/api/track/${b.token}`, { identity: users.client2 }))
      .status,
    404,
  );
  assert.equal(
    (await env.request(`/api/track/${b.token}`, { identity: users.client }))
      .status,
    200,
  );
  assert.equal(
    (
      await env.request(`/api/personnel/${users.foreman.user.id}`, {
        identity: users.client2,
      })
    ).status,
    404,
  );
  assert.equal((await own(users.foreman)).projects.length, 1);
  assert.equal((await own(users.foreman2)).projects.length, 0);
  assert.equal((await own(users.employee2)).projects.length, 0);
  assert.ok(
    (await own(users.foreman)).materials.some((m) => m.id === material.id),
  );
  for (const identity of [users.foreman, users.employee, users.client]) {
    await env.action(
      identity,
      "user",
      { name: "Intruder", role: "Admin" },
      403,
    );
    await env.action(identity, "settings", { name: "Intruder" }, 403);
    await env.action(
      identity,
      "payroll",
      { userId: users.employee2.user.id },
      403,
    );
    await env.action(identity, "payment", { projectId: p.id, amount: 1 }, 403);
  }
  await env.action(users.foreman2, "inspection", { id: i.id }, 403);
  await env.action(
    users.foreman2,
    "progress",
    { projectId: p.id, progress: 50, notes: "Intruder" },
    403,
  );
  await env.action(users.foreman, "task", {
    projectId: p.id,
    name: "Install roof",
    assigneeId: users.employee.user.id,
    start: "2026-10-04",
    due: "2099-10-10",
    progress: 20,
  });
  const task = env.store.read().tasks[0];
  await env.action(users.foreman, "progress", {
    projectId: p.id,
    progress: 40,
    notes: "Roof materials on site",
  });
  const usage = env.store.read().usage[0];
  await env.action(users.foreman, "usage", {
    projectId: p.id,
    id: usage.id,
    used: 20,
    delivered: 100,
  });
  assert.equal((await own(users.employee)).tasks.length, 1);
  assert.equal((await own(users.employee2)).tasks.length, 0);
  const descriptor = Array(128).fill(0.1);
  await env.action(env.admin, "enroll", {
    userId: users.employee.user.id,
    descriptor,
  });
  await env.action(users.employee, "attendance", {
    userId: users.employee2.user.id,
    descriptor,
    latitude: 14.6,
    longitude: 121,
  });
  let state = env.store.read(),
    attendance = state.attendance[0];
  assert.equal(attendance.userId, users.employee.user.id);
  assert.equal((await own(users.employee2)).attendance.length, 0);
  assert.equal(
    JSON.stringify(await own(users.foreman)).includes('"descriptor"'),
    false,
  );
  attendance.checkIn = new Date(Date.now() - 8 * 3600000).toISOString();
  env.store.save(state); // Synthetic clock fixture, no real personnel or biometric data.
  await env.action(users.employee, "attendance", {
    descriptor,
    latitude: 14.6,
    longitude: 121,
  });
  await env.action(env.admin, "payroll", {
    userId: users.employee.user.id,
    from: "2020-01-01",
    to: "2099-12-31",
    deductions: 20,
  });
  const payroll = env.store.read().payroll[0];
  await env.action(env.admin, "payrollUpdate", {
    id: payroll.id,
    deductions: 30,
    reason: "Approved adjustment",
  });
  await env.action(env.admin, "payrollPaid", { id: payroll.id });
  assert.equal((await own(users.employee)).payroll[0].status, "Paid");
  assert.equal((await own(users.employee2)).payroll.length, 0);
  await env.action(
    users.employee2,
    "payrollUpdate",
    { id: payroll.id, deductions: 0 },
    403,
  );
  await env.action(
    env.admin,
    "attendanceUpdate",
    { id: attendance.id, hours: 1, reason: "test" },
    400,
  );
  await env.action(
    env.admin,
    "payrollUpdate",
    { id: payroll.id, deductions: 0, reason: "test" },
    400,
  );
  await env.action(users.foreman, "task", {
    id: task.id,
    projectId: p.id,
    name: task.name,
    assigneeId: task.assigneeId,
    start: task.start,
    due: task.due,
    progress: 100,
  });
  await env.action(users.foreman, "complete", { id: p.id, requirements: true });
  await env.action(env.admin, "payment", {
    projectId: p.id,
    amount: 45000,
    method: "Bank Transfer",
    date: "2026-10-04",
    reference: "SYNTHETIC-2",
  });
  await env.action(
    users.client2,
    "feedback",
    { projectId: p.id, token: b.token },
    403,
  );
  await env.action(users.client, "feedback", {
    projectId: p.id,
    token: b.token,
    installation: 5,
    service: 4,
    timeliness: 5,
    professionalism: 5,
    comments: "Synthetic feedback",
  });
  const adminState = await own(env.admin);
  assert.equal(adminState.projects.length, 1);
  assert.equal(adminState.bookings.length, 2);
  assert.equal(adminState.feedback.length, 1);
  assert.equal(
    adminState.payments.reduce((sum, p) => sum + p.amount, 0),
    55000,
  );
  assert.equal((await own(users.client2)).feedback.length, 0);
  const clientNotifications = (await own(users.client)).notifications;
  assert.ok(clientNotifications.some((n) => n.title === "Quotation available"));
  assert.ok(clientNotifications.some((n) => n.title === "Payment received"));
  assert.ok(
    (await own(users.employee)).notifications.some(
      (n) => n.title === "Payroll released",
    ),
  );
  assert.equal((await own(users.employee2)).notifications.length, 0);
  for (const identity of Object.values(users))
    assert.ok(
      (await own(identity)).notifications.every(
        (n) => n.userId === identity.user.id,
      ),
    );
  await env.action(users.client, "read", {});
  assert.ok((await own(users.client)).notifications.every((n) => n.read));
  assert.ok((await own(env.admin)).notifications.some((n) => !n.read));
  await env.action(users.employee, "profile", {
    userId: users.employee2.user.id,
    name: "Updated employee",
    contact: "111",
    role: "Admin",
    rate: 99999,
  });
  assert.equal(
    env.store.read().users.find((u) => u.id === users.employee.user.id).role,
    "Employee",
  );
  assert.equal(
    env.store.read().users.find((u) => u.id === users.employee2.user.id).name,
    "employee2",
  );
});

test("account activation, unique emails, role changes, last admin and session revocation", async (t) => {
  const env = await setup(t),
    users = await accounts(env);
  const employee = env.store
    .read()
    .users.find((u) => u.id === users.employee.user.id);
  await env.action(env.admin, "user", { ...employee, active: "Inactive" });
  assert.equal(
    (await env.request("/api/state", { identity: users.employee })).status,
    401,
  );
  assert.equal(
    (
      await env.request("/api/auth/login", {
        method: "POST",
        data: { email: employee.email, password },
      })
    ).status,
    401,
  );
  await env.action(env.admin, "user", {
    ...employee,
    active: "Active",
    password: "Replacement-password-2026",
  });
  assert.equal(
    (
      await env.request("/api/auth/login", {
        method: "POST",
        data: { email: employee.email, password },
      })
    ).status,
    401,
  );
  await env.action(env.admin, "user", { ...employee, role: "Secretary" }, 400);
  await env.action(
    env.admin,
    "user",
    { ...employee, role: "Site Engineer" },
    400,
  );
  await env.action(
    env.admin,
    "user",
    { ...employee, email: env.admin.user.email },
    400,
  );
  const admin = env.store.read().users[0];
  await env.action(env.admin, "user", { ...admin, active: "Inactive" }, 400);
  await env.action(env.admin, "user", {
    ...employee,
    role: "Foreman",
    active: "Active",
  });
  assert.equal(
    env.store.read().users.find((u) => u.id === employee.id).role,
    "Foreman",
  );
  const updated = await env.request("/api/auth/login", {
    method: "POST",
    data: { email: employee.email, password: "Replacement-password-2026" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.role, "Foreman");
});

test("sessions survive server restart, expire, and credentials never enter state", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "eng-auth-")),
    path = join(dir, "test.sqlite");
  const store = createStore(path),
    s = store.read();
  s.users.push({
    id: "a",
    email: "a@example.test",
    name: "Admin",
    role: "Admin",
    active: true,
    sessionVersion: 0,
    passwordHash: hashPassword(password),
  });
  store.save(s);
  let server = createApi(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  let base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@example.test", password }),
  });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  await new Promise((resolve) => server.close(resolve));
  store.close();
  const reopened = createStore(path);
  server = createApi(reopened).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    reopened.close();
    rmSync(dir, { recursive: true });
  });
  base = `http://127.0.0.1:${server.address().port}`;
  const state = await fetch(base + "/api/state", {
    headers: { Cookie: cookie },
  });
  assert.equal(state.status, 200);
  const text = await state.text();
  assert.equal(text.includes("passwordHash"), false);
  assert.equal(text.includes("sessionVersion"), false);
  reopened.db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal(
    (await fetch(base + "/api/state", { headers: { Cookie: cookie } })).status,
    401,
  );
});

test("failed logins are rate limited, and forged direct domain actors are rejected", async (t) => {
  const env = await setup(t);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await env.request("/api/auth/login", {
          method: "POST",
          data: { email: "unknown@example.test", password },
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await env.request("/api/auth/login", {
        method: "POST",
        data: { email: "unknown@example.test", password },
      })
    ).status,
    429,
  );
  assert.throws(
    () =>
      apply(
        env.store.read(),
        "settings",
        { name: "Intruder" },
        { id: "missing", role: "Admin" },
      ),
    /authenticated/,
  );
});

test("legacy booking linking and administrative corrections preserve history", async (t) => {
  const env = await setup(t),
    users = await accounts(env);
  let s = env.store.read();
  s.bookings.push({
    id: "legacy",
    ...booking,
    email: "guest@example.test",
    name: "Legacy request",
    status: "Pending",
    token: "legacy-token",
    submitted_at: new Date().toISOString(),
  });
  env.store.save(s);
  await env.action(
    users.client,
    "bookingOwner",
    { id: "legacy", clientId: users.client.user.id },
    403,
  );
  await env.action(env.admin, "bookingOwner", {
    id: "legacy",
    clientId: users.client.user.id,
  });
  await env.action(
    env.admin,
    "bookingOwner",
    { id: "legacy", clientId: users.client2.user.id },
    400,
  );
  assert.equal(
    (await env.request("/api/track/legacy-token", { identity: users.client }))
      .status,
    200,
  );
  const { p } = await project(env, users);
  const payment = env.store.read().payments[0];
  await env.action(env.admin, "paymentUpdate", {
    id: payment.id,
    remarks: "Verified receipt",
  });
  assert.equal(env.store.read().payments[0].amount, payment.amount);
  assert.equal(
    env.store.read().payments[0].annotations[0].remarks,
    "Verified receipt",
  );
  await env.action(env.admin, "notification", {
    userId: env.admin.user.id,
    title: "Private note",
    message: "One recipient",
  });
  assert.equal(
    env.store.read().notifications.filter((n) => n.title === "Private note")
      .length,
    1,
  );
  s = env.store.read();
  s.attendance.push({
    id: "correction",
    userId: users.employee.user.id,
    projectId: p.id,
    date: "2026-10-04",
    hours: 7,
    checkIn: "2026-10-04T00:00:00.000Z",
    checkOut: "2026-10-04T07:00:00.000Z",
    verified: true,
  });
  env.store.save(s);
  await env.action(env.admin, "attendanceUpdate", {
    id: "correction",
    hours: 8,
    reason: "Approved correction",
  });
  assert.equal(env.store.read().attendance[0].corrections[0].previousHours, 7);
  await env.action(
    env.admin,
    "user",
    {
      ...env.store.read().users.find((u) => u.id === users.foreman.user.id),
      role: "Employee",
    },
    400,
  );
});

test("profile password changes verify old credentials and revoke existing sessions", async (t) => {
  const env = await setup(t),
    users = await accounts(env);
  await env.action(
    users.client,
    "profile",
    {
      name: "Client",
      contact: "000",
      currentPassword: "wrong",
      password: "New-client-password-2026",
    },
    400,
  );
  await env.action(users.client, "profile", {
    name: "Client",
    contact: "000",
    currentPassword: password,
    password: "New-client-password-2026",
  });
  assert.equal(
    (await env.request("/api/state", { identity: users.client })).status,
    401,
  );
  assert.equal(
    (
      await env.request("/api/auth/login", {
        method: "POST",
        data: {
          email: users.client.user.email,
          password: "New-client-password-2026",
        },
      })
    ).status,
    200,
  );
});

test("registering a legacy guest email never claims its records on restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "eng-migration-")),
    path = join(dir, "migration.sqlite");
  let store;
  try {
    store = createStore(path);
    const s = store.read();
    s.bookings.push({
      id: "guest",
      ...booking,
      name: "Historical guest",
      email: "guest@example.test",
      token: "guest-token",
      status: "Pending",
    });
    s.users.push({
      id: "new-client",
      name: "New registration",
      email: "guest@example.test",
      role: "Client",
      active: true,
      sessionVersion: 0,
      passwordHash: hashPassword(password),
    });
    store.save(s);
    store.close();
    store = createStore(path);
    assert.equal(store.read().bookings[0].clientId, undefined);
  } finally {
    store?.close();
    rmSync(dir, { recursive: true });
  }
});

test("production authentication requires HTTPS origin and sets secure cookies", async (t) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const store = createStore(":memory:"),
    s = store.read();
  s.users.push({
    id: "production-admin",
    name: "Admin",
    email: "admin@example.test",
    role: "Admin",
    active: true,
    sessionVersion: 0,
    passwordHash: hashPassword(password),
  });
  store.save(s);
  const server = createApi(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (origin) =>
    fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.test", password }),
    });
  assert.equal((await login(base)).status, 403);
  const response = await login(base.replace("http:", "https:"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Secure/);
});

test("missing company settings are repaired without replacing existing records", () => {
  const dir = mkdtempSync(join(tmpdir(), "eng-settings-")),
    path = join(dir, "settings.sqlite");
  let store;
  try {
    store = createStore(path);
    const s = store.read();
    s.users.push({
      id: "existing",
      name: "Existing Client",
      email: "existing@example.test",
      role: "Client",
      active: true,
      sessionVersion: 0,
    });
    s.bookings.push({
      id: "existing-booking",
      ...booking,
      name: "Existing request",
      email: "existing@example.test",
      clientId: "existing",
      status: "Pending",
      token: "existing-token",
    });
    s.settings = [];
    store.save(s);
    store.close();
    store = createStore(path, { sample: true });
    assert.equal(store.read().users.length, 1);
    assert.equal(store.read().bookings[0].id, "existing-booking");
    assert.equal(store.read().settings.length, 1);
    assert.equal(store.read().projects.length, 0);
  } finally {
    store?.close();
    rmSync(dir, { recursive: true });
  }
});
