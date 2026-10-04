import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./seed.js";
import { apply as domainApply, balance } from "./domain.js";
import { createStore } from "./test-database.js";
// Fixtures remain optional sample data; workflow actions now use actual client identities.
function apply(s, action, data, actor) {
  for (const b of s.bookings) {
    if (!b.clientId) {
      let u = s.users.find((u) => u.role === "Client" && u.email === b.email);
      if (!u) {
        u = {
          id: `fixture-${b.id}`,
          name: b.name,
          email: b.email,
          role: "Client",
          active: true,
        };
        s.users.push(u);
      }
      b.clientId = u.id;
    }
  }
  if (!actor) {
    const b = s.bookings.find((b) => b.token === data.token);
    let client = b && s.users.find((u) => u.id === b.clientId);
    if (!client) {
      client = s.users.find((u) => u.id === "fixture-client");
      if (!client) {
        client = {
          id: "fixture-client",
          name: "Test Roofing Client",
          email: "synthetic@example.test",
          role: "Client",
          active: true,
        };
        s.users.push(client);
      }
    }
    actor = client;
  }
  return domainApply(s, action, data, actor);
}
const admin = { id: "USR-1", role: "Admin" },
  foreman = { id: "USR-2", role: "Foreman" },
  employee = { id: "USR-3", role: "Employee" };
const booking = () => ({
  name: "Test Roofing Client",
  email: "synthetic@example.test",
  phone: "09170000000",
  address: "Synthetic test site",
  date: "2099-10-10",
  time: "09:00",
  service: "Roof Replacement",
  type: "Residential",
  description: "Leaking roof",
});
function estimate(s) {
  const b = apply(s, "book", booking());
  apply(
    s,
    "booking",
    { id: b.id, status: "For Inspection", foremanId: "USR-2" },
    admin,
  );
  const i = s.inspections.find((i) => i.bookingId === b.id);
  apply(
    s,
    "inspection",
    {
      id: i.id,
      date: "2099-10-10",
      area: 120,
      linear: 40,
      sections: 2,
      profile: "Rib-Type / Ribbed",
      condition: "Damaged",
      complexity: "Moderate",
      accessories: ["Ridge Cap"],
    },
    foreman,
  );
  apply(
    s,
    "estimate",
    {
      inspectionId: i.id,
      items: [
        { materialId: "MAT-2", quantity: 120 },
        { materialId: "MAT-7", quantity: 20 },
      ],
      charges: 10000,
    },
    foreman,
  );
  return { b, i, q: s.quotations.find((q) => q.inspectionId === i.id) };
}
function approved(s) {
  const { b, i, q } = estimate(s);
  apply(s, "finalize", { id: q.id, downpayment: 24300 }, admin);
  apply(s, "quoteDecision", { id: q.id, token: b.token, status: "Approved" });
  return { b, i, q, p: s.projects.find((p) => p.quotationId === q.id) };
}
test("complete booking → inspection → quote → project → payment → feedback workflow", () => {
  const s = seed(),
    { b, q, p } = approved(s);
  assert.equal(q.total, 81000);
  assert.equal(p.progress, 0);
  assert.equal(s.usage.filter((u) => u.projectId === p.id).length, 2);
  assert.throws(
    () => apply(s, "complete", { id: p.id, requirements: true }, admin),
    /Assign/,
  );
  apply(
    s,
    "project",
    {
      id: p.id,
      name: "Synthetic Roof",
      foremanId: "USR-2",
      employeeIds: ["USR-3"],
      start: "2099-10-11",
      end: "2099-10-15",
      status: "Scheduled",
    },
    admin,
  );
  assert.throws(
    () => apply(s, "complete", { id: p.id, requirements: true }, admin),
    /required project tasks/,
  );
  apply(
    s,
    "task",
    {
      projectId: p.id,
      name: "Final installation and inspection",
      assigneeId: "USR-3",
      start: p.start,
      due: p.end,
      progress: 100,
      required: true,
    },
    foreman,
  );
  assert.throws(
    () => apply(s, "complete", { id: p.id, requirements: false }, admin),
    /requirements/,
  );
  apply(
    s,
    "payment",
    {
      projectId: p.id,
      amount: q.total,
      method: "Bank Transfer",
      date: "2099-10-15",
      reference: "SYNTHETIC-PAY",
    },
    admin,
  );
  apply(s, "complete", { id: p.id, requirements: true }, foreman);
  assert.equal(p.locked, true);
  assert.equal(balance(s, p), 0);
  assert.throws(() => apply(s, "project", { id: p.id }, admin), /locked/);
  assert.ok(
    s.emails.some(
      (e) => e.path.includes(b.token) && e.subject.includes("feedback"),
    ),
  );
  apply(s, "feedback", {
    token: b.token,
    projectId: p.id,
    installation: 5,
    service: 4,
    timeliness: 3,
    professionalism: 5,
    comments: "Synthetic test feedback",
  });
  assert.equal(s.feedback.at(-1).timeliness, 3);
  assert.throws(
    () =>
      apply(s, "feedback", {
        token: b.token,
        projectId: p.id,
        installation: 5,
        service: 5,
        timeliness: 5,
        professionalism: 5,
      }),
    /already/,
  );
});
test("booking timestamps, token uniqueness, validation and role permissions", () => {
  const s = seed(),
    a = apply(s, "book", booking()),
    b = apply(s, "book", booking());
  assert.notEqual(a.token, b.token);
  assert.ok(!isNaN(Date.parse(a.submitted_at)));
  assert.throws(
    () => apply(s, "book", { ...booking(), date: "2020-01-01" }),
    /past/,
  );
  assert.throws(
    () => apply(s, "booking", { id: a.id, status: "Approved" }, employee),
    /role/,
  );
  assert.throws(
    () => apply(s, "book", { ...booking(), service: "General Construction" }),
    /roofing service/,
  );
});
test("prices are snapshots; admin changes quantities without replacing saved prices", () => {
  const s = seed(),
    { q } = estimate(s);
  apply(s, "material", { ...s.materials[1], price: 999 }, admin);
  apply(
    s,
    "finalize",
    {
      id: q.id,
      items: [{ materialId: "MAT-2", quantity: 100 }],
      charges: 1000,
      downpayment: 20000,
    },
    admin,
  );
  assert.equal(q.items[0].price, 550);
  assert.equal(q.total, 56000);
  assert.equal(s.materials[1].price, 999);
  assert.equal(s.materials[1].history.length, 1);
  assert.throws(() => apply(s, "finalize", { id: q.id }, foreman), /role/);
});
test("client cannot approve a quotation using a different booking", () => {
  const s = seed(),
    { b, q } = estimate(s),
    other = apply(s, "book", booking());
  apply(s, "finalize", { id: q.id }, admin);
  assert.throws(
    () =>
      apply(s, "quoteDecision", {
        id: q.id,
        token: other.token,
        status: "Approved",
      }),
    /not awaiting/,
  );
  assert.throws(
    () =>
      apply(s, "quoteDecision", {
        id: q.id,
        token: "invalid",
        status: "Approved",
      }),
    /invalid/,
  );
  assert.equal(
    s.projects.some((p) => p.bookingId === b.id),
    false,
  );
});
test("payments reject overpayment, negatives and lock on final payment after completion", () => {
  const s = seed(),
    p = s.projects[0],
    remaining = balance(s, p);
  assert.throws(
    () =>
      apply(s, "payment", { projectId: p.id, amount: remaining + 0.01 }, admin),
    /exceed/,
  );
  assert.throws(
    () => apply(s, "payment", { projectId: p.id, amount: -1 }, admin),
    /at least/,
  );
  s.tasks
    .filter((t) => t.projectId === p.id)
    .forEach((t) => (t.progress = 100));
  apply(s, "complete", { id: p.id, requirements: true }, admin);
  assert.equal(p.locked, false);
  apply(
    s,
    "payment",
    {
      projectId: p.id,
      amount: remaining,
      method: "Cash",
      date: "2026-10-04",
      reference: "TEST-FINAL",
    },
    admin,
  );
  assert.equal(p.locked, true);
});
test("feedback only after completion, all ratings in range", () => {
  const s = seed();
  assert.throws(
    () =>
      apply(s, "feedback", { projectId: "PRJ-001", token: "sample-track-1" }),
    /completion/,
  );
  s.feedback = [];
  assert.throws(
    () =>
      apply(s, "feedback", {
        projectId: "PRJ-005",
        token: "sample-track-5",
        installation: 6,
        service: 5,
        timeliness: 5,
        professionalism: 5,
      }),
    /1 to 5/,
  );
});
test("material usage rejects usage beyond delivery and cross-project records", () => {
  const s = seed();
  assert.throws(
    () =>
      apply(
        s,
        "usage",
        { projectId: "PRJ-001", id: "USE-1-1", delivered: 10, used: 11 },
        foreman,
      ),
    /exceed/,
  );
  assert.throws(
    () =>
      apply(
        s,
        "usage",
        { projectId: "PRJ-001", id: "USE-2-1", delivered: 120, used: 100 },
        foreman,
      ),
    /does not belong/,
  );
});
test("facial descriptor enrollment, match, geotag, automatic assignment and checkout", () => {
  const s = seed(),
    descriptor = Array(128).fill(0.1);
  s.projects[0].start = "2020-01-01";
  s.projects[0].end = "2099-12-31";
  apply(s, "enroll", { userId: employee.id, descriptor }, admin);
  assert.throws(
    () =>
      apply(
        s,
        "attendance",
        { descriptor: Array(128).fill(0.8), latitude: 14.6, longitude: 121 },
        employee,
      ),
    /failed/,
  );
  assert.throws(
    () => apply(s, "attendance", { descriptor }, employee),
    /Location/,
  );
  const a = apply(
    s,
    "attendance",
    { descriptor, latitude: 14.6, longitude: 121 },
    employee,
  );
  assert.equal(a.projectId, "PRJ-001");
  assert.equal(a.verified, true);
  a.checkIn = new Date(Date.now() - 8 * 3600000).toISOString();
  const out = apply(
    s,
    "attendance",
    { descriptor, latitude: 14.6, longitude: 121 },
    employee,
  );
  assert.equal(out.hours, 8);
  assert.ok(out.checkOut);
  assert.throws(
    () =>
      apply(
        s,
        "attendance",
        { descriptor, latitude: 14.6, longitude: 121 },
        employee,
      ),
    /already complete/,
  );
});
test("payroll uses only completed verified attendance, prevents overlap and retains daily rate", () => {
  const s = seed();
  s.attendance.push({
    ...s.attendance[0],
    id: "ATT-FAKE",
    checkOut: null,
    hours: 8,
    date: "2026-10-03",
  });
  apply(
    s,
    "payroll",
    { userId: "USR-3", from: "2026-10-01", to: "2026-10-04", deductions: 50 },
    admin,
  );
  const p = s.payroll[0];
  assert.equal(p.hours, 8);
  assert.equal(p.days, 1);
  assert.equal(p.gross, 750);
  assert.equal(p.net, 700);
  s.users.find((u) => u.id === "USR-3").rate = 1000;
  assert.equal(p.rate, 750);
  assert.throws(
    () =>
      apply(
        s,
        "payroll",
        { userId: "USR-3", from: "2026-10-04", to: "2026-10-05" },
        admin,
      ),
    /overlaps/,
  );
  assert.throws(
    () =>
      apply(
        s,
        "payroll",
        { userId: "USR-5", from: "2026-10-01", to: "2026-10-04" },
        admin,
      ),
    /No completed/,
  );
});
test("MySQL round trip and atomic transaction rollback", async () => {
  const store = await createStore(":memory:", { sample: true }),
    s = await store.read();
  const b = apply(s, "book", booking());
  await store.save(s);
  assert.equal(
    (await store.read()).bookings.find((x) => x.id === b.id).token,
    b.token,
  );
  const invalid = await store.read();
  invalid.bookings.push(invalid.bookings[0]);
  await assert.rejects(() => store.save(invalid));
  assert.equal((await store.read()).bookings.length, s.bookings.length);
  await store?.close();
});
test("database foreign keys reject orphan relationships", async () => {
  const store = await createStore(":memory:", { sample: true }),
    s = await store.read();
  s.projects[0].quotationId = "MISSING";
  await assert.rejects(() => store.save(s), /foreign key/i);
  assert.equal((await store.read()).projects[0].quotationId, "QT-001");
  await store?.close();
});
test("completed unpaid work is immutable while final payment remains allowed", () => {
  const s = seed(),
    p = s.projects[0];
  s.tasks
    .filter((t) => t.projectId === p.id)
    .forEach((t) => (t.progress = 100));
  apply(s, "complete", { id: p.id, requirements: true }, admin);
  assert.throws(
    () => apply(s, "task", { projectId: p.id }, foreman),
    /preserved/,
  );
  assert.throws(
    () => apply(s, "usage", { projectId: p.id }, foreman),
    /preserved/,
  );
  assert.throws(() => apply(s, "project", { id: p.id }, admin), /preserved/);
});

test("sample quotation totals and quantities are financially consistent", () => {
  const s = seed();
  for (const q of s.quotations) {
    assert.ok(q.charges >= 0);
    assert.equal(
      q.total,
      q.items.reduce((total, line) => total + line.quantity * line.price, 0) +
        q.charges,
    );
  }
  for (const p of s.projects) assert.ok(balance(s, p) >= 0);
});
