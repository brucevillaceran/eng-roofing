import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "./seed.js";
import { apply } from "./domain.js";
import { visibleState } from "./access.js";
import {
  inspectionMaterialAmount,
  standardInspectionItems,
} from "../shared/inspection.js";

const admin = { id: "USR-1", role: "Admin" },
  foreman = { id: "USR-2", role: "Foreman" },
  client = { id: "USR-6", role: "Client" },
  today = () => new Date().toISOString().slice(0, 10),
  names = [
    "Roofing Sheet",
    "Ridge Cap",
    "Flashing",
    "Valley Flashing",
    "Eaves Flashing",
    "Barge/Side Flashing",
    "Roofing Screws",
    "Sealant",
    "Closure Strips",
    "Gutter",
    "Downsprout",
  ];

function prepare(service) {
  const state = seed(),
    receipt = apply(
      state,
      "book",
      {
        name: "Test Roofing Client",
        email: "maria@example.com",
        phone: "09170000000",
        address: "Synthetic site",
        date: "2099-10-10",
        time: "09:00",
        service,
        type: "Residential",
        description: "Site inspection test",
      },
      client,
    ),
    booking = state.bookings.find((item) => item.id === receipt.id);
  apply(
    state,
    "bookingDecision",
    { id: booking.id, status: "Approved" },
    admin,
  );
  const inspection = state.inspections.find(
    (item) => item.bookingId === booking.id,
  );
  apply(
    state,
    "inspectionAssign",
    { id: inspection.id, foremanId: foreman.id, date: today() },
    admin,
  );
  return { state, booking, inspection };
}

function detailsFor(service) {
  if (service === "Roof Installation")
    return {
      supportingCondition: "Good",
      laborCharges: 1000,
    };
  if (service === "Roof Replacement")
    return {
      existingMaterialId: "MAT-1",
      existingProfile: "Corrugated",
      existingArea: 120,
      existingMaterialCondition: "Poor",
      structuralCondition: "Good",
      structuralWork: "Minor Repair",
      removalRequired: true,
      disposalRequired: true,
      removalCharges: 2000,
      laborCharges: 1000,
      additionalCharges: 500,
    };
  return {
    existingMaterialId: "MAT-1",
    existingProfile: "Corrugated",
    existingArea: 120,
    damagedArea: 10,
    damageType: "Flashing Repair",
    damageSeverity: "Moderate",
    damagedSheets: 2,
    repairCharges: 3000,
    laborCharges: 1000,
    additionalCharges: 500,
  };
}

function submission(
  inspection,
  serviceType,
  items,
  details = detailsFor(serviceType),
) {
  return {
    id: inspection.id,
    serviceType,
    date: today(),
    area: 120,
    linear: 40,
    sections: 2,
    profile: "Corrugated",
    complexity: "Moderate",
    condition:
      serviceType === "Roof Replacement"
        ? "Fair"
        : serviceType === "Roof Repair"
          ? "Poor"
          : "Good",
    details,
    items,
    notes: "Foreman site notes",
    clientNotes: "Client-facing inspection findings",
    photos: [],
  };
}

test("all three service types receive the full standard material starting rows", () => {
  for (const serviceType of [
    "Roof Installation",
    "Roof Replacement",
    "Roof Repair",
  ]) {
    const { state, inspection } = prepare(serviceType);
    assert.deepEqual(
      inspection.items.map((item) =>
        item.name === "Banawe" ? "Roofing Sheet" : item.name,
      ),
      names,
      `${serviceType} starts with every standard row`,
    );
    const roofingSheet = inspection.items[0];
    assert.equal(roofingSheet.unit, "SQM");
    assert.equal(roofingSheet.price, 500);
    assert.equal(roofingSheet.thickness, "0.40 mm");
    assert.equal(standardInspectionItems(state.materials).length, 11);
    assert.deepEqual(
      state.materials
        .filter((material) => material.category === "Roofing Sheet")
        .map(({ name, thickness, price, unit }) => [
          name,
          thickness,
          price,
          unit,
        ]),
      [
        ["Banawe", "0.40 mm", 500, "SQM"],
        ["Twin Rib", "0.40 mm", 550, "SQM"],
        ["Tilespan", "0.40 mm", 600, "SQM"],
        ["R-Span", "0.50 mm", 750, "SQM"],
        ["Standing Seam", "0.50 mm", 800, "SQM"],
        ["Steel Decking", "0.80 mm", 850, "SQM"],
        ["Curve Roof", "0.50 mm", 850, "SQM"],
        ["Tile Profile", "0.50 mm", 900, "SQM"],
      ],
    );
  }
});

test("Foreman service selection retains the standard defaults for the selected service", () => {
  const { state, inspection } = prepare("Roof Installation"),
    selectedServiceItems = standardInspectionItems(state.materials);
  apply(
    state,
    "inspectionDraft",
    {
      id: inspection.id,
      serviceType: "Roof Repair",
      items: selectedServiceItems.map(({ materialId }) => ({
        materialId,
        quantity: "",
      })),
    },
    foreman,
  );
  assert.equal(inspection.serviceType, "Roof Repair");
  assert.equal(inspection.items.length, 11);
  assert.equal(inspection.items[0].unit, "SQM");
});

test("roofing sheet selection snapshots catalog thickness and price and calculates amounts", () => {
  const { state, inspection } = prepare("Roof Installation");
  apply(
    state,
    "inspectionSubmit",
    submission(inspection, "Roof Installation", [
      { materialId: "MAT-2", quantity: 120 },
      { materialId: "MAT-7", quantity: 4 },
    ]),
    foreman,
  );
  const quote = state.quotations.find(
    (item) => item.inspectionId === inspection.id,
  );
  assert.deepEqual(
    quote.items.map((item) => [
      item.name,
      item.unit,
      item.price,
      item.quantity,
    ]),
    [
      ["Twin Rib", "SQM", 550, 120],
      ["Ridge Cap", "LM", 250, 4],
    ],
  );
  assert.equal(
    quote.items.reduce((sum, item) => sum + inspectionMaterialAmount(item), 0),
    67000,
  );
  assert.equal(quote.total, 67000);
});

test("installation, replacement, and repair rows support add, edit, and delete", () => {
  for (const serviceType of [
    "Roof Installation",
    "Roof Replacement",
    "Roof Repair",
  ]) {
    const { state, inspection } = prepare(serviceType),
      initialIds = inspection.items.map((item) => item.materialId),
      editedItems = [
        { materialId: "MAT-2", quantity: 120 },
        { materialId: "MAT-8", quantity: 3 },
        { materialId: "MAT-13", quantity: 2 },
        { materialId: "MAT-12", quantity: 10 },
        { materialId: "MAT-3", quantity: 4 },
      ];
    apply(
      state,
      "inspectionDraft",
      { id: inspection.id, serviceType, items: editedItems },
      foreman,
    );
    assert.equal(inspection.items.length, 5, `${serviceType} CRUD row count`);
    assert.ok(initialIds.includes("MAT-8"));
    assert.ok(!inspection.items.some((item) => item.materialId === "MAT-9"));
    assert.equal(
      inspection.items.find((item) => item.materialId === "MAT-3").name,
      "Tilespan",
    );
    assert.equal(
      inspection.items.find((item) => item.materialId === "MAT-3").quantity,
      4,
    );
    assert.equal(
      inspection.items.find((item) => item.materialId === "MAT-3").price,
      600,
    );
    assert.equal(
      inspection.items.find((item) => item.materialId === "MAT-13").quantity,
      2,
    );
    assert.equal(
      inspection.items.find((item) => item.materialId === "MAT-2").price,
      550,
    );
  }
});

test("replacement and repair submit only used rows in the initial material quotation", () => {
  for (const [serviceType, rows] of [
    [
      "Roof Replacement",
      [
        { materialId: "MAT-2", quantity: 10 },
        { materialId: "MAT-8", quantity: 2 },
      ],
    ],
    [
      "Roof Repair",
      [
        { materialId: "MAT-8", quantity: 3 },
        { materialId: "MAT-13", quantity: 2 },
        { materialId: "MAT-12", quantity: 10 },
      ],
    ],
  ]) {
    const { state, booking, inspection } = prepare(serviceType);
    apply(
      state,
      "inspectionSubmit",
      submission(inspection, serviceType, rows),
      foreman,
    );
    const quote = state.quotations.find(
      (item) => item.inspectionId === inspection.id,
    );
    assert.equal(quote.items.length, rows.length);
    assert.equal(quote.charges, 0);
    assert.equal(inspection.status, "Submitted for Review");
    assert.equal(booking.status, "Approved");
    assert.equal(
      state.projects.some((project) => project.bookingId === booking.id),
      false,
    );
  }
});

test("inspection validation is service-specific and accepts only the defined service types", () => {
  const { state, inspection } = prepare("Roof Installation"),
    validItems = [{ materialId: "MAT-2", quantity: 1 }];
  assert.throws(
    () =>
      apply(
        state,
        "inspectionSubmit",
        submission(inspection, "Roof Restoration", validItems),
        foreman,
      ),
    /Service type/,
  );
  assert.throws(
    () =>
      apply(
        state,
        "inspectionSubmit",
        submission(inspection, "Roof Installation", validItems, {}),
        foreman,
      ),
    /supporting structure condition/,
  );
  assert.throws(
    () =>
      apply(
        state,
        "inspectionSubmit",
        submission(inspection, "Roof Repair", validItems, {
          ...detailsFor("Roof Repair"),
          damageSeverity: "Minor",
        }),
        foreman,
      ),
    /damageSeverity/,
  );
  const replacement = prepare("Roof Replacement");
  assert.throws(
    () =>
      apply(
        replacement.state,
        "inspectionSubmit",
        {
          ...submission(replacement.inspection, "Roof Replacement", validItems),
          condition: "Severe",
        },
        foreman,
      ),
    /existing roof condition/,
  );
});

test("only Approved bookings can proceed to inspection", () => {
  const { state, booking, inspection } = prepare("Roof Installation");
  booking.status = "For Inspection";
  assert.throws(
    () =>
      apply(
        state,
        "inspectionDraft",
        { id: inspection.id, serviceType: "Roof Installation" },
        foreman,
      ),
    /Only approved bookings/,
  );
});

test("submitted price snapshots and complete inspection details reach Admin review", () => {
  const { state, inspection, booking } = prepare("Roof Replacement"),
    details = {
      ...detailsFor("Roof Replacement"),
      existingDamage: "Corrosion around the eaves",
    };
  apply(
    state,
    "inspectionSubmit",
    submission(
      inspection,
      "Roof Replacement",
      [{ materialId: "MAT-2", quantity: 120 }],
      details,
    ),
    foreman,
  );
  const quote = state.quotations.find(
    (item) => item.inspectionId === inspection.id,
  );
  assert.equal(quote.status, "Initial Estimate");
  assert.equal(quote.items[0].price, 550);
  assert.equal(quote.items[0].quantity, 120);
  assert.equal(inspection.details.existingDamage, details.existingDamage);
  assert.equal(inspection.notes, "Foreman site notes");
  const adminState = visibleState(state, admin),
    adminInspection = adminState.inspections.find(
      (item) => item.id === inspection.id,
    ),
    adminQuote = adminState.quotations.find(
      (item) => item.inspectionId === inspection.id,
    );
  assert.equal(adminInspection.details.existingDamage, details.existingDamage);
  assert.equal(adminInspection.items[0].price, 550);
  assert.equal(adminQuote.status, "Initial Estimate");
  assert.equal(adminQuote.total, quote.total);
  assert.equal(
    state.notifications
      .find(
        (item) =>
          item.role === "Admin" &&
          item.title === "Inspection submitted for review",
      )
      ?.message.includes(String(quote.total)),
    true,
  );
  assert.equal(
    state.projects.some((project) => project.bookingId === booking.id),
    false,
  );

  apply(
    state,
    "material",
    {
      ...Object.fromEntries(
        Object.entries(state.materials[1]).filter(([key]) => key !== "history"),
      ),
      price: 600,
    },
    admin,
  );
  assert.equal(quote.items[0].price, 550);
  assert.equal(inspection.items[0].price, 550);
});
