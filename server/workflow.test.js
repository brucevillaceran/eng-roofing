import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./seed.js";
import { apply as domainApply, balance } from "./domain.js";
import { createStore } from "./test-database.js";
import { encode, decode, models } from "./database-model.js";
import { visibleState } from "./access.js";
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
test("quotation database mapping round-trips all Admin adjustment fields", () => {
  const record = {
    id: "QT-MAPPING",
    bookingId: "BK-1",
    inspectionId: "IN-1",
    charges: 38000,
    hardwareAttachments: 5000,
    installationFee: 20000,
    deliveryCharges: 3000,
    insulation: 8000,
    otherCharges: 2000,
    discount: 5000,
    total: 133000,
    downpayment: 66500,
    status: "Awaiting Client",
    notes: "Mapping test",
    createdAt: "2026-10-05T13:00:00.000Z",
  };
  const definition = models.quotations;
  const encoded = encode(record, definition);
  const row = {
    id: record.id,
    ...Object.fromEntries(
      Object.keys(definition).map((key, index) => [key, encoded[index]]),
    ),
    _fields: encoded.at(-1),
  };
  assert.deepEqual(decode(row, definition), record);
});
const today = () => new Date().toISOString().slice(0, 10);
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
  const result = apply(s, "book", booking());
  const b = s.bookings.find((booking) => booking.id === result.id);
  apply(s, "bookingDecision", { id: b.id, status: "Approved" }, admin);
  const i = s.inspections.find((i) => i.bookingId === b.id);
  apply(
    s,
    "inspectionAssign",
    {
      id: i.id,
      foremanId: "USR-2",
      date: new Date().toISOString().slice(0, 10),
    },
    admin,
  );
  apply(
    s,
    "inspection",
    {
      id: i.id,
      date: new Date().toISOString().slice(0, 10),
      area: 120,
      linear: 40,
      sections: 2,
      profile: "Rib-Type / Ribbed",
      condition: "Damaged",
      complexity: "Moderate",
      accessories: ["Ridge Cap"],
    },
    admin,
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
    },
    foreman,
  );
  return { b, i, q: s.quotations.find((q) => q.inspectionId === i.id) };
}
function approved(s) {
  const { b, i, q } = estimate(s);
  apply(s, "finalize", { id: q.id }, admin);
  apply(s, "quoteDecision", { id: q.id, token: b.token, status: "Approved" });
  return { b, i, q, p: s.projects.find((p) => p.quotationId === q.id) };
}
test("complete booking → inspection → quote → project → payment → feedback workflow", () => {
  const s = seed(),
    { b, q, p } = approved(s);
  assert.equal(q.total, 71000);
  assert.equal(q.downpayment, 35500);
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
      date: new Date().toISOString().slice(0, 10),
      reference: "SYNTHETIC-PAY",
    },
    admin,
  );
  apply(s, "complete", { id: p.id, requirements: true }, foreman);
  assert.equal(p.locked, true);
  assert.equal(balance(s, p), 0);
  assert.throws(
    () => apply(s, "project", { id: p.id, status: "On Hold" }, admin),
    /locked/,
  );
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

test("final quotation sets a 50% requested downpayment without recording payment", () => {
  const s = seed();
  const finalizeAt = (total, finalizeData = {}) => {
    const { b, i, q } = estimate(s);
    assert.equal(q.downpayment, 0, "initial estimate has no downpayment");
    assert.throws(
      () =>
        apply(
          s,
          "estimate",
          {
            inspectionId: i.id,
            items: [{ materialId: "MAT-2", quantity: 100 }],
            downpayment: 1,
          },
          foreman,
        ),
      /downpayment: this field cannot be changed/i,
      "Foreman cannot supply a required downpayment",
    );
    assert.throws(
      () =>
        apply(
          s,
          "finalize",
          {
            id: q.id,
            items: finalizeData.items || [
              { materialId: "MAT-2", quantity: 100 },
            ],
            charges: total - 55000,
            downpayment: 1,
          },
          admin,
        ),
      /downpayment: this field cannot be changed/i,
      "Admin cannot override the calculated amount",
    );
    assert.throws(
      () => apply(s, "finalize", { id: q.id }, foreman),
      /role/,
      "Foreman cannot finalize or set the amount",
    );
    apply(
      s,
      "finalize",
      {
        id: q.id,
        items: finalizeData.items || [{ materialId: "MAT-2", quantity: 100 }],
        ...(finalizeData.charges
          ? finalizeData.charges
          : { charges: total - 55000 }),
      },
      admin,
    );
    assert.equal(q.total, total);
    assert.equal(q.downpayment, total * 0.5);
    assert.equal(q.total - q.downpayment, total * 0.5);
    assert.equal(
      s.projects.some((project) => project.bookingId === b.id),
      false,
    );
    assert.equal(
      s.payments.some((payment) =>
        s.projects.some(
          (project) =>
            project.bookingId === b.id && project.id === payment.projectId,
        ),
      ),
      false,
    );
    assert.throws(
      () =>
        apply(s, "quoteDecision", {
          id: q.id,
          token: b.token,
          status: "Approved",
          downpayment: 0,
        }),
      /downpayment: this field cannot be changed/i,
      "Client cannot modify the required amount",
    );
    return { b, q };
  };
  const hundredThousand = finalizeAt(100000);
  assert.equal(hundredThousand.q.downpayment, 50000);
  const oneHundredThirtyThreeThousand = finalizeAt(133000, {
    items: [
      { materialId: "MAT-2", quantity: 100 },
      { materialId: "MAT-7", quantity: 180 },
    ],
    charges: {
      hardwareAttachments: 5000,
      installationFee: 20000,
      deliveryCharges: 3000,
      insulation: 8000,
      otherCharges: 2000,
      discount: 5000,
    },
  });
  assert.equal(oneHundredThirtyThreeThousand.q.downpayment, 66500);
  assert.equal(oneHundredThirtyThreeThousand.q.total, 133000);
  const clientQuote = visibleState(s, {
    id: oneHundredThirtyThreeThousand.b.clientId,
    role: "Client",
  }).quotations.find(
    (quote) => quote.id === oneHundredThirtyThreeThousand.q.id,
  );
  assert.ok(clientQuote);
  assert.equal(clientQuote.hardwareAttachments, 5000);
  assert.equal(clientQuote.installationFee, 20000);
  assert.equal(clientQuote.deliveryCharges, 3000);
  assert.equal(clientQuote.insulation, 8000);
  assert.equal(clientQuote.otherCharges, 2000);
  assert.equal(clientQuote.discount, 5000);
  assert.equal(clientQuote.total, 133000);
  assert.equal(clientQuote.downpayment, 66500);
  assert.deepEqual(
    Object.fromEntries(
      [
        "hardwareAttachments",
        "installationFee",
        "deliveryCharges",
        "insulation",
        "otherCharges",
        "discount",
      ].map((key) => [key, oneHundredThirtyThreeThousand.q[key]]),
    ),
    {
      hardwareAttachments: 5000,
      installationFee: 20000,
      deliveryCharges: 3000,
      insulation: 8000,
      otherCharges: 2000,
      discount: 5000,
    },
  );
  assert.equal(oneHundredThirtyThreeThousand.q.charges, 38000);
  const quotationEmail = s.emails.find(
    (email) => email.subject === "Your final roofing quotation is ready",
  );
  for (const label of [
    "Hardware & Attachments",
    "Installation Fee",
    "Delivery Charges",
    "Insulation",
    "Other Charges",
    "Discount",
  ])
    assert.ok(quotationEmail.message.includes(label));
  const clientNotification = s.notifications.find(
    (notification) =>
      notification.userId === oneHundredThirtyThreeThousand.b.clientId &&
      notification.title === "Quotation available",
  );
  assert.ok(clientNotification);
  assert.match(clientNotification.message, /Final total: ₱133000\.00/);
  assert.match(clientNotification.message, /downpayment \(50%\): ₱66500\.00/);

  const changed = estimate(s);
  apply(
    s,
    "finalize",
    {
      id: changed.q.id,
      items: [{ materialId: "MAT-2", quantity: 120 }],
      charges: 54000,
    },
    admin,
  );
  assert.equal(changed.q.total, 120000);
  assert.equal(changed.q.downpayment, 60000);
  assert.equal(changed.q.downpayment, changed.q.total * 0.5);
});
test("booking timestamps, token uniqueness, validation and role permissions", () => {
  const s = seed(),
    aResult = apply(s, "book", booking()),
    bResult = apply(s, "book", booking()),
    a = s.bookings.find((x) => x.id === aResult.id),
    b = s.bookings.find((x) => x.id === bResult.id);
  assert.notEqual(a.token, b.token);
  assert.ok(!isNaN(Date.parse(a.submitted_at)));
  assert.throws(
    () => apply(s, "book", { ...booking(), date: "2020-01-01" }),
    /Preferred date/,
  );
  assert.throws(
    () =>
      apply(s, "bookingDecision", { id: a.id, status: "Approved" }, employee),
    /role/,
  );
  assert.throws(
    () => apply(s, "book", { ...booking(), service: "General Construction" }),
    /Service/,
  );
});

test("guest booking is accepted without creating a client account and keeps a tracking token", () => {
  const s = seed();
  const result = domainApply(s, "book", {
    name: "Guest Roofing Client",
    email: "guest@example.test",
    phone: "09171234567",
    address: "Guest test site",
    date: "2099-10-10",
    time: "09:00",
    service: "Roof Replacement",
    type: "Residential",
    description: "Guest booking test",
  });
  const b = s.bookings.at(-1);
  assert.equal(result.id, b.id);
  assert.equal(result.token, undefined);
  assert.equal(b.status, "Pending");
  assert.equal(b.clientId, undefined);
  assert.ok(typeof b.token === "string" && b.token.length > 16);
  assert.equal(s.emails.at(-1).path, undefined);
  assert.equal(s.emails.at(-1).message.includes(b.token), false);
  assert.equal(
    s.users.some(
      (u) => u.role === "Client" && u.email === "guest@example.test",
    ),
    false,
  );
});
test("admin approval emails guests using their saved booking email and track link", () => {
  const s = seed();
  const result = domainApply(s, "book", {
    name: "Guest Approval Client",
    email: "guest-approval@example.test",
    phone: "09170000000",
    address: "Approval test site",
    date: "2099-11-11",
    time: "10:00",
    service: "Roof Repair",
    type: "Residential",
    description: "Approval email test",
  });
  const b = s.bookings.find((booking) => booking.id === result.id);
  assert.equal(result.token, undefined);
  apply(s, "bookingDecision", { id: b.id, status: "Approved" }, admin);
  const mail = s.emails.find(
    (entry) =>
      entry.to === "guest-approval@example.test" &&
      entry.path.includes(b.token),
  );
  assert.ok(mail);
  assert.equal(b.status, "Approved");
  assert.equal(
    s.inspections.find((i) => i.bookingId === b.id).status,
    "Awaiting Assignment",
  );
  assert.match(mail.subject, /approved/i);
  assert.match(mail.message, /Your roofing booking has been approved/i);
  assert.match(mail.message, /Approval test site/);
  assert.match(mail.message, /Track My Project/i);
  assert.match(mail.message, new RegExp(`/track/${b.token}`));
});
test("admin rejection sends no tracking link and never creates an inspection", () => {
  const s = seed();
  const result = domainApply(s, "book", {
    name: "Guest Rejection Client",
    email: "guest-rejection@example.test",
    phone: "09170000000",
    address: "Rejection test site",
    date: "2099-11-11",
    time: "10:00",
    service: "Roof Repair",
    type: "Residential",
    description: "Rejection email test",
  });
  const b = s.bookings.find((booking) => booking.id === result.id);
  apply(s, "bookingDecision", { id: b.id, status: "Rejected" }, admin);
  const mail = s.emails.find((entry) => entry.to === b.email);
  assert.equal(b.status, "Rejected");
  assert.equal(mail.path, undefined);
  assert.match(mail.subject, /rejected/i);
  assert.match(mail.message, /rejected/i);
  assert.equal(mail.message.includes(b.token), false);
  assert.equal(
    s.inspections.some((i) => i.bookingId === b.id),
    false,
  );
  assert.throws(
    () => apply(s, "bookingDecision", { id: b.id, status: "Approved" }, admin),
    /pending bookings/,
  );
});
test("pending bookings cannot be assigned or inspected through direct actions", () => {
  const s = seed();
  const result = domainApply(s, "book", {
    name: "Pending Workflow Client",
    email: "pending-workflow@example.test",
    phone: "09170000000",
    address: "Pending workflow site",
    date: "2099-11-11",
    time: "10:00",
    service: "Roof Repair",
    type: "Residential",
    description: "Pending inspection restriction",
  });
  const b = s.bookings.find((booking) => booking.id === result.id);
  const i = {
    id: "IN-PENDING-WORKFLOW",
    bookingId: b.id,
    foremanId: foreman.id,
    date: b.date,
    status: "Scheduled",
  };
  s.inspections.push(i);
  assert.throws(
    () =>
      apply(
        s,
        "inspectionAssign",
        { id: i.id, foremanId: foreman.id, date: "2099-11-11" },
        admin,
      ),
    /approved bookings/,
  );
  assert.throws(
    () =>
      apply(
        s,
        "inspectionSubmit",
        {
          id: i.id,
          date: new Date().toISOString().slice(0, 10),
        },
        foreman,
      ),
    /approved bookings/,
  );
});
test("inspection submission creates an initial estimate from catalog price snapshots", () => {
  const s = seed();
  const receipt = domainApply(s, "book", {
    ...booking(),
    service: "Roof Installation",
  });
  const b = s.bookings.find((booking) => booking.id === receipt.id);
  apply(s, "bookingDecision", { id: b.id, status: "Approved" }, admin);
  const i = s.inspections.find((inspection) => inspection.bookingId === b.id);
  apply(
    s,
    "inspectionAssign",
    { id: i.id, foremanId: foreman.id, date: today() },
    admin,
  );
  assert.throws(
    () =>
      apply(
        s,
        "inspection",
        {
          id: i.id,
          area: 50,
          linear: 20,
          sections: 1,
          profile: "Corrugated",
          complexity: "Simple",
          condition: "Good",
        },
        foreman,
      ),
    /unavailable for your role/,
  );
  const material = s.materials.find((item) => item.id === "MAT-2");
  const submission = {
    id: i.id,
    serviceType: "Roof Installation",
    date: today(),
    area: 120,
    linear: 40,
    sections: 2,
    profile: "Rib-Type / Ribbed",
    complexity: "Moderate",
    details: {
      supportingCondition: "Good",
      additionalCharges: 1000,
    },
    items: [{ materialId: material.id, quantity: 120 }],
    photos: [],
  };
  for (const invalid of [
    { ...submission, area: 0 },
    { ...submission, linear: -1 },
    { ...submission, sections: 1.5 },
    { ...submission, items: [{ materialId: material.id, quantity: 0 }] },
    {
      ...submission,
      details: { ...submission.details, additionalCharges: -1 },
    },
    {
      ...submission,
      items: [{ materialId: material.id, quantity: 120, price: 1 }],
    },
  ])
    assert.throws(() => apply(s, "inspectionSubmit", invalid, foreman));
  assert.equal(
    s.quotations.some((quote) => quote.inspectionId === i.id),
    false,
  );
  apply(s, "inspectionSubmit", submission, foreman);
  const q = s.quotations.find((quote) => quote.inspectionId === i.id);
  assert.equal(i.status, "Submitted for Review");
  assert.equal(q.status, "Initial Estimate");
  assert.equal(q.items[0].price, material.price);
  assert.equal(q.items[0].unit, material.unit);
  assert.equal(q.items[0].quantity, 120);
  assert.equal(q.total, 120 * material.price);
  material.price += 100;
  assert.equal(q.items[0].price, material.price - 100);
  assert.ok(
    s.notifications.some((notification) =>
      notification.title.includes("submitted for review"),
    ),
  );
});
test("service-specific inspection submission excludes charges from the initial material quotation", () => {
  for (const [service, details] of [
    [
      "Roof Replacement",
      {
        existingMaterialId: "MAT-1",
        existingProfile: "Corrugated",
        existingArea: 50,
        existingMaterialCondition: "Fair",
        structuralCondition: "Good",
        replacementScope: "Full Roof Replacement",
        structuralWork: "Minor Repair",
        removalRequired: true,
        disposalRequired: true,
        removalCharges: 2000,
        repairCharges: 3000,
        additionalCharges: 500,
      },
    ],
    [
      "Roof Repair",
      {
        existingMaterialId: "MAT-1",
        existingProfile: "Corrugated",
        existingArea: 50,
        damagedArea: 10,
        damagedSheets: 1,
        damageType: "Leak Repair",
        damageSeverity: "Moderate",
        repairType: "Leak Repair",
        removalCharges: 2000,
        repairCharges: 3000,
        additionalCharges: 500,
      },
    ],
  ]) {
    const s = seed(),
      receipt = domainApply(s, "book", { ...booking(), service });
    const b = s.bookings.find((booking) => booking.id === receipt.id);
    apply(s, "bookingDecision", { id: b.id, status: "Approved" }, admin);
    const i = s.inspections.find((inspection) => inspection.bookingId === b.id);
    apply(
      s,
      "inspectionAssign",
      { id: i.id, foremanId: foreman.id, date: today() },
      admin,
    );
    apply(
      s,
      "inspectionSubmit",
      {
        id: i.id,
        serviceType: service,
        date: today(),
        area: 50,
        linear: 20,
        sections: 1,
        profile: "Corrugated",
        complexity: "Simple",
        condition: "Fair",
        details,
        items: [{ materialId: "MAT-2", quantity: 10 }],
        photos: [],
      },
      foreman,
    );
    const q = s.quotations.find((quote) => quote.inspectionId === i.id);
    assert.equal(q.charges, 0, `${service} initial quotation is material-only`);
    assert.equal(
      q.total,
      10 * s.materials.find((material) => material.id === "MAT-2").price,
    );
  }
});
test("prices are snapshots; admin changes quantities without replacing saved prices", () => {
  const s = seed(),
    { q } = estimate(s);
  apply(
    s,
    "material",
    {
      ...Object.fromEntries(
        Object.entries(s.materials[1]).filter(([k]) => k !== "history"),
      ),
      price: 999,
    },
    admin,
  );
  apply(
    s,
    "finalize",
    {
      id: q.id,
      items: [{ materialId: "MAT-2", quantity: 100 }],
      charges: 1000,
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
    otherReceipt = apply(s, "book", booking()),
    other = s.bookings.find((booking) => booking.id === otherReceipt.id);
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
      apply(
        s,
        "payment",
        {
          projectId: p.id,
          amount: remaining + 0.01,
          method: "Cash",
          date: "2026-10-04",
          reference: "TEST",
        },
        admin,
      ),
    /exceed/,
  );
  assert.throws(
    () => apply(s, "payment", { projectId: p.id, amount: -1 }, admin),
    /from/,
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
      apply(s, "feedback", {
        projectId: "PRJ-001",
        token: "sample-track-1",
        installation: 5,
        service: 5,
        timeliness: 5,
        professionalism: 5,
      }),
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
test("facial enrollment, match, geotag and explicit Foreman project checkout", () => {
  const s = seed(),
    descriptor = Array(128).fill(0.1);
  s.attendance = [];
  s.projects[0].start = "2020-01-01";
  s.projects[0].end = "2099-12-31";
  apply(s, "enroll", { userId: employee.id, descriptor }, admin);
  const request = {
    projectId: "PRJ-001",
    userId: employee.id,
    operation: "timeIn",
    descriptor,
    latitude: 14.6,
    longitude: 121,
  };
  assert.throws(
    () =>
      apply(
        s,
        "attendance",
        { ...request, descriptor: Array(128).fill(0.8) },
        foreman,
      ),
    /failed/,
  );
  assert.throws(
    () => apply(s, "attendance", { ...request, latitude: undefined }, foreman),
    /location/,
  );
  const a = apply(s, "attendance", request, foreman);
  assert.equal(a.projectId, "PRJ-001");
  assert.equal(a.foremanId, foreman.id);
  assert.equal(a.verified, true);
  a.checkIn = new Date(Date.now() - 8 * 3600000).toISOString();
  const out = apply(
    s,
    "attendance",
    { ...request, operation: "timeOut", attendanceId: a.id },
    foreman,
  );
  assert.equal(out.hours, 8);
  assert.ok(out.checkOut);
  assert.throws(
    () => apply(s, "attendance", request, foreman),
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
  assert.throws(
    () =>
      apply(
        s,
        "payroll",
        { userId: "USR-3", from: "2026-10-01", to: "2026-10-04" },
        admin,
      ),
    /active Time Outs/,
  );
  s.attendance = s.attendance.filter((a) => a.id !== "ATT-FAKE");
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
        { userId: "USR-3", from: "2026-10-04", to: "2026-10-04" },
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
  const savedBooking = s.bookings.find((x) => x.id === b.id);
  await store.save(s);
  assert.equal(
    (await store.read()).bookings.find((x) => x.id === b.id).token,
    savedBooking.token,
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
    () =>
      apply(
        s,
        "task",
        { ...s.tasks.find((t) => t.projectId === p.id), projectId: p.id },
        foreman,
      ),
    /preserved/,
  );
  assert.throws(
    () =>
      apply(
        s,
        "usage",
        {
          id: s.usage.find((u) => u.projectId === p.id).id,
          projectId: p.id,
          delivered: 1,
          used: 0,
        },
        foreman,
      ),
    /preserved/,
  );
  assert.throws(
    () => apply(s, "project", { id: p.id, status: "On Hold" }, admin),
    /preserved/,
  );
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
