import test from "node:test";
import assert from "node:assert/strict";
import { visibleState } from "./access.js";
import { createApi } from "./api.js";

test("tracking API denies pending, rejected and unknown tokens", async (t) => {
  const state = {
    bookings: [
      { id: "pending", token: "pending-token", status: "Pending" },
      { id: "rejected", token: "rejected-token", status: "Rejected" },
      { id: "approved", token: "approved-token", status: "Approved" },
    ],
    inspections: [],
    quotations: [
      {
        id: "approved-quote",
        bookingId: "approved",
        total: 100,
        status: "Approved",
      },
    ],
    projects: [
      { id: "pending-project", bookingId: "pending" },
      {
        id: "approved-project",
        bookingId: "approved",
        quotationId: "approved-quote",
      },
    ],
    users: [],
    tasks: [],
    payments: [],
    feedback: [],
  };
  const server = createApi({
    db: {
      execute: async () => {
        throw new Error("Anonymous tracking must not query session data.");
      },
    },
    read: async () => state,
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const track = async (token) => {
    const response = await fetch(
      `${base}/api/track/${encodeURIComponent(token)}`,
    );
    return { status: response.status, body: await response.json() };
  };

  for (const token of ["pending-token", "rejected-token", "unknown-token"]) {
    const response = await track(token);
    assert.equal(response.status, 404);
    assert.equal(response.body.project, undefined);
    assert.equal(response.body.booking, undefined);
  }

  const approved = await track("approved-token");
  assert.equal(approved.status, 200);
  assert.equal(approved.body.booking.id, "approved");
  assert.equal(approved.body.project.id, "approved-project");
});

test("client workspace withholds pending and rejected tracking tokens", () => {
  const state = {
    bookings: [
      {
        id: "pending",
        clientId: "client",
        token: "pending-token",
        status: "Pending",
      },
      {
        id: "rejected",
        clientId: "client",
        token: "rejected-token",
        status: "Rejected",
      },
      {
        id: "approved",
        clientId: "client",
        token: "approved-token",
        status: "Approved",
      },
    ],
    projects: [],
    inspections: [
      { id: "pending-inspection", bookingId: "pending" },
      { id: "rejected-inspection", bookingId: "rejected" },
      { id: "approved-inspection", bookingId: "approved" },
    ],
    quotations: [],
    users: [],
    tasks: [],
    materials: [],
    usage: [],
    attendance: [],
    payroll: [],
    payments: [],
    feedback: [],
    notifications: [],
    emails: [],
    settings: [],
  };
  const clientState = visibleState(state, { id: "client", role: "Client" });
  const bookingById = new Map(clientState.bookings.map((b) => [b.id, b]));

  assert.equal("token" in bookingById.get("pending"), false);
  assert.equal("token" in bookingById.get("rejected"), false);
  assert.equal(bookingById.get("approved").token, "approved-token");
  assert.deepEqual(
    clientState.inspections.map((i) => i.bookingId),
    ["approved"],
  );
});
