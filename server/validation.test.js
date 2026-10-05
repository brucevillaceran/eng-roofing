import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createStore } from "./test-database.js";
import { createStore as reopen } from "./store.js";
import { createApi } from "./api.js";
import { hashPassword } from "./auth.js";
import {
  personName,
  phoneNumber,
  emailAddress,
  numberValue,
  dateValue,
  timeValue,
  photoValue,
  validateAction,
  validateAuth,
  today,
} from "../shared/validation.js";
import { checkField } from "../src/form-validation.js";
const password = "Synthetic-validation-password";
const descriptor = Array(128).fill(0.1);
const validUser = (role) => ({
  name: `Validation ${role}`,
  email: `${role.toLowerCase()}@validation.test`,
  contact: "09123456789",
  role,
  password,
  active: "Active",
  ...(role === "Employee" ? { rate: "850.50", descriptor } : {}),
});
async function api(t) {
  const store = await createStore();
  await store.transaction((s) =>
    s.users.push({
      id: "operator",
      name: "Validation Operator",
      email: "operator@validation.test",
      role: "Admin",
      active: true,
      sessionVersion: 0,
      passwordHash: hashPassword(password),
    }),
  );
  const server = createApi(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { data, identity } = {}) => {
    const response = await fetch(base + path, {
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
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const login = async (email) => {
    const r = await request("/api/auth/login", { data: { email, password } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { cookie: r.cookie, csrf: r.body.csrf, user: r.body.user };
  };
  const admin = await login("operator@validation.test");
  const action = async (name, data, status = 200, identity = admin) => {
    const r = await request("/api/action", {
      data: { action: name, data },
      identity,
    });
    assert.equal(r.status, status, `${name}: ${JSON.stringify(r.body)}`);
    return r.body;
  };
  return { store, request, login, admin, action };
}
test("shared text, phone, email, decimal, calendar, time and media boundaries", () => {
  for (const phone of [
    "0912345678",
    "091234567890",
    "08123456789",
    "09abc456789",
    "09123 45678",
    "+639123456789",
    9123456789,
    null,
  ])
    assert.throws(() => phoneNumber(phone));
  assert.equal(phoneNumber("09123456789"), "09123456789");
  assert.equal(personName("  María   O’Neil-Santos  "), "María O’Neil-Santos");
  for (const name of [
    "Juan2",
    "Juan@Santos",
    "-Juan",
    "O''Neil",
    "Juan--Santos",
    "Juan\nSantos",
  ])
    assert.throws(() => personName(name));
  assert.equal(
    emailAddress("  USER+tag@Example.COM  "),
    "user+tag@example.com",
  );
  for (const email of [
    "a@",
    "@b.com",
    "a b@c.com",
    "a..b@example.com",
    "a@-bad.com",
    "a@example..com",
    "a@@b.com",
    false,
  ])
    assert.throws(() => emailAddress(email));
  for (const number of [
    "",
    null,
    true,
    [],
    {},
    "1e3",
    "0x10",
    " 2",
    "1,000",
    "-1",
    "1.234",
    "Infinity",
    Infinity,
  ])
    assert.throws(() => numberValue(number, "Amount"));
  assert.equal(numberValue("12.50", "Amount"), 12.5);
  assert.throws(() => numberValue("1.1", "Sections", { decimals: 0 }));
  assert.throws(() => numberValue(101, "Progress", { max: 100 }));
  assert.throws(() => numberValue(1000001, "Quantity", { max: 1000000 }));
  assert.equal(dateValue("2024-02-29", "Date"), "2024-02-29");
  for (const d of ["2025-02-29", "2026-04-31", "2026-1-01", "not-date", 123])
    assert.throws(() => dateValue(d, "Date"));
  for (const time of ["24:00", "12:60", "9:00", "09:00 PM", null])
    assert.throws(() => timeValue(time));
  assert.equal(timeValue("23:59"), "23:59");
  assert.throws(() => photoValue("https://example.test/photo.png"));
  assert.throws(() => photoValue("data:image/svg+xml;base64,PHN2Zz4="));
  assert.throws(() => photoValue("data:image/png;base64,c3ludGhldGlj"));
  assert.throws(() =>
    validateAuth("register", {
      name: "Valid Client",
      email: "client@example.test",
      contact: "09123456789",
      password,
      rate: 10,
    }),
  );
});
test("shared frontend input adapter rejects invalid values without HTML validation", () => {
  const element = (value, type, extra = {}) => ({
    value,
    type,
    disabled: false,
    required: true,
    dataset: { validation: type, label: "Test field" },
    min: "0",
    max: "100",
    step: "0.01",
    maxLength: 150,
    validity: { valid: true },
    setCustomValidity(message) {
      this.message = message;
    },
    getAttribute() {
      return null;
    },
    ...extra,
  });
  for (const e of [
    element("0912345678", "phone"),
    element("John2", "person"),
    element("bad email", "email"),
    element("1e2", "number"),
    element("101", "number"),
    element("2026-02-30", "date", { min: "2000-01-01", max: "2100-12-31" }),
    element("24:01", "time"),
  ])
    assert.ok(checkField(e));
  const name = element("  Ana   María  ", "person");
  assert.equal(checkField(name, true), undefined);
  assert.equal(name.value, "Ana María");
});
test("real API rejects invalid fields and enforces all four account-role combinations", async (t) => {
  const env = await api(t);
  for (const phone of [
    "0912345678",
    "091234567890",
    "08123456789",
    "09abc456789",
  ])
    await env.action("user", { ...validUser("Client"), contact: phone }, 400);
  for (const patch of [
    { name: "Client123" },
    { email: "invalid email" },
    { role: "Secretary" },
    { role: "Site Engineer" },
    { rate: -1 },
  ])
    await env.action("user", { ...validUser("Client"), ...patch }, 400);
  const employee = validUser("Employee");
  const noRate = { ...employee };
  delete noRate.rate;
  await env.action("user", noRate, 400);
  const noFace = { ...employee };
  delete noFace.descriptor;
  await env.action("user", noFace, 400);
  for (const rate of [-1, 0, "", 100001, "850.555", true])
    await env.action("user", { ...employee, rate }, 400);
  for (const face of [
    [],
    Array(127).fill(0.1),
    Array(128).fill("0.1"),
    Array(128).fill(9),
  ])
    await env.action("user", { ...employee, descriptor: face }, 400);
  for (const role of ["Admin", "Foreman", "Client"]) {
    await env.action("user", { ...validUser(role), rate: 800 }, 400);
    await env.action("user", { ...validUser(role), rate: 0 }, 400);
    await env.action("user", { ...validUser(role), descriptor }, 400);
  }
  assert.equal(
    (await env.store.read()).users.length,
    1,
    "invalid creation must not persist",
  );
  const identities = {};
  for (const role of ["Admin", "Foreman", "Employee", "Client"]) {
    await env.action("user", validUser(role));
    identities[role] = await env.login(validUser(role).email);
    const [[row]] = await env.store.db.execute(
      "SELECT role,rate,descriptor FROM users WHERE email=?",
      [validUser(role).email],
    );
    assert.equal(row.role, role);
    if (role === "Employee") {
      assert.equal(row.rate, 850.5);
      assert.ok(row.descriptor);
    } else {
      assert.equal(row.rate, null);
      assert.equal(row.descriptor, null);
    }
  }
  for (const role of ["Admin", "Foreman", "Client"]) {
    await env.action(
      "enroll",
      { userId: identities[role].user.id, descriptor },
      400,
    );
    await env.action(
      "payroll",
      {
        userId: identities[role].user.id,
        from: today(),
        to: today(),
        deductions: 0,
      },
      400,
    );
  }
  for (const role of ["Employee", "Client", "Admin"])
    await env.action(
      "attendance",
      { descriptor, latitude: 14, longitude: 121 },
      403,
      identities[role],
    );
  await env.action(
    "enroll",
    { userId: identities.Employee.user.id, descriptor },
    403,
    identities.Employee,
  );
  await env.action("enroll", {
    userId: identities.Employee.user.id,
    descriptor,
  });
  await env.action("user", {
    ...validUser("Employee"),
    id: identities.Employee.user.id,
    rate: "900.00",
    descriptor: undefined,
    password: "",
  });
  const own = (
    await env.request("/api/state", { identity: identities.Foreman })
  ).body;
  assert.deepEqual(own.userPayrollArchive, []);
  await env.action(
    "profile",
    { name: "Bad9", contact: "09123456789" },
    400,
    identities.Client,
  );
  await env.action(
    "profile",
    { name: "Valid Client", contact: "09123456789", rate: 900 },
    400,
    identities.Client,
  );
});
test("real workflow API validates every input category, foreign IDs, and rejected writes atomically", async (t) => {
  const env = await api(t);
  for (const role of ["Foreman", "Employee", "Client"])
    await env.action("user", validUser(role));
  const client = await env.login(validUser("Client").email);
  const s = await env.store.read(),
    foreman = s.users.find((u) => u.role === "Foreman");
  const book = {
    phone: "09123456789",
    address: "Synthetic site",
    date: today(),
    time: "09:00",
    service: "Roof Replacement",
    type: "Residential",
    description: "Inspect the roof.",
  };
  for (const patch of [
    { phone: "0912345678" },
    { date: "2026-02-30" },
    { date: "1999-01-01" },
    { time: "25:00" },
    { description: "x".repeat(2001) },
    { description: 42 },
    { photos: ["data:image/png;base64,AAAA"] },
    { type: "Unknown" },
  ])
    await env.action("book", { ...book, ...patch }, 400, client);
  const b = await env.action("book", book, 200, client);
  await env.action("bookingDecision", { id: b.id, status: "Approved" });
  const pendingInspection = (await env.store.read()).inspections.find(
    (i) => i.bookingId === b.id,
  );
  await env.action("inspectionAssign", {
    id: pendingInspection.id,
    foremanId: foreman.id,
    date: today(),
  });
  const inspection = (await env.store.read()).inspections[0];
  const survey = {
    id: inspection.id,
    date: today(),
    area: 100,
    linear: 30,
    sections: 2,
    profile: "Rib-Type / Ribbed",
    complexity: "Simple",
    condition: "Damaged",
    accessories: [],
    notes: "Site survey",
  };
  for (const patch of [
    { area: -1 },
    { linear: 1000001 },
    { sections: 1.5 },
    { profile: "Forged" },
    { complexity: "Impossible" },
    { accessories: ["Unknown"] },
  ])
    await env.action("inspection", { ...survey, ...patch }, 400);
  await env.action("inspection", survey);
  const material = {
    name: "Roofing screws",
    category: "Accessory",
    unit: "PCS",
    price: "5.25",
    profile: "Other",
    thickness: "",
  };
  for (const patch of [
    { price: -1 },
    { price: "10abc" },
    { price: "1.222" },
    { price: 1000001 },
    { unit: "arbitrary" },
    { thickness: "thick" },
  ])
    await env.action("material", { ...material, ...patch }, 400);
  await env.action("material", material);
  const mat = (await env.store.read()).materials[0];
  for (const quantity of [-1, 0, "", true, "1e3", 1000001, 1.5])
    await env.action(
      "estimate",
      {
        inspectionId: inspection.id,
        items: [{ materialId: mat.id, quantity }],
      },
      400,
    );
  await env.action(
    "estimate",
    {
      inspectionId: inspection.id,
      items: [{ materialId: "MISSING", quantity: 10 }],
    },
    400,
  );
  await env.action("estimate", {
    inspectionId: inspection.id,
    items: [{ materialId: mat.id, quantity: 10 }],
    charges: 100.01,
    notes: "  Normal punctuation, preserved!  ",
  });
  const q = (await env.store.read()).quotations[0];
  assert.equal(q.notes, "Normal punctuation, preserved!");
  await env.action("finalize", { id: q.id });
  assert.equal((await env.store.read()).quotations[0].downpayment, 45.75);
  await env.action(
    "quoteDecision",
    {
      id: q.id,
      token: (await env.store.read()).bookings.find((x) => x.id === b.id).token,
      status: "Approved",
    },
    200,
    client,
  );
  const p = (await env.store.read()).projects[0];
  for (const progress of [-1, 101, "1e2", "12.345"])
    await env.action(
      "progress",
      { projectId: p.id, progress, notes: "Update" },
      400,
    );
  await env.action(
    "progress",
    { projectId: "MISSING", progress: 50, notes: "Update" },
    400,
  );
  await env.action(
    "payment",
    {
      projectId: p.id,
      amount: 1,
      method: "Cash",
      date: "2100-01-01",
      reference: "Future",
    },
    400,
  );
  await env.action(
    "settings",
    { name: "Valid Company", payrollNote: "x".repeat(2001) },
    400,
  );
  await env.action(
    "notification",
    { userId: "MISSING", title: "Test", message: "Test" },
    400,
  );
  const before = (await env.store.read()).projects[0].progress;
  await env.action(
    "progress",
    { projectId: p.id, progress: 101, notes: "Update" },
    400,
  );
  assert.equal((await env.store.read()).projects[0].progress, before);
});
test("legacy non-employee payroll attributes are archived once without changing users or financial history", async () => {
  const store = await createStore(`archive-${randomUUID()}`, { sample: true });
  await store.transaction((s) => {
    const foreman = s.users.find((u) => u.role === "Foreman");
    foreman.descriptor = descriptor;
    s.attendance.push({
      ...s.attendance[0],
      id: "legacy-foreman-attendance",
      userId: foreman.id,
    });
    s.payroll.push({
      id: "legacy-foreman-payroll",
      userId: foreman.id,
      from: "2026-10-01",
      to: "2026-10-02",
      attendanceIds: ["legacy-foreman-attendance"],
      days: 1,
      hours: 8,
      rate: 950,
      gross: 950,
      deductions: 0,
      net: 950,
      status: "Paid",
      createdAt: "2026-10-03T00:00:00.000Z",
      releasedAt: "2026-10-03T00:00:00.000Z",
    });
  });
  const before = await store.read();
  await store.close();
  const reopened = await reopen(store.testConfig);
  try {
    const after = await reopened.read();
    assert.equal(after.users.length, before.users.length);
    for (const u of after.users)
      if (u.role !== "Employee") {
        assert.equal(u.rate, undefined);
        assert.equal(u.descriptor, undefined);
      }
    const archive = after.userPayrollArchive.find((a) => a.role === "Foreman");
    assert.equal(archive.rate, 950);
    assert.deepEqual(archive.descriptor, descriptor);
    for (const field of ["attendance", "payroll", "payments", "projects"])
      assert.deepEqual(after[field], before[field]);
    const count = after.userPayrollArchive.length;
    await reopened.close();
    const again = await reopen(store.testConfig);
    try {
      assert.equal((await again.read()).userPayrollArchive.length, count);
    } finally {
      await again.close();
    }
  } finally {
    await reopened.close();
  }
});
