import { identifier, ValidationError } from "../shared/validation.js";
import express from "express";
import { apply, balance } from "./domain.js";
import { configureAuth, authenticated, authorizeSession } from "./auth.js";
import { visibleState } from "./access.js";
export function createApi(store) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  app.use(express.json({ limit: "12mb" }));
  app.use("/api", (req, res, next) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      (req.body === null ||
        Array.isArray(req.body) ||
        typeof req.body !== "object")
    )
      return res.status(400).json({ error: "A JSON object is required." });
    next();
  });
  configureAuth(app, store);
  async function readAuthorized(req) {
    const s = await store.read();
    await authorizeSession(store.db, req, s);
    return s;
  }
  app.get("/api/health", async (_, res) => {
    await store.db.query("SELECT 1");
    res.json({ ok: true });
  });
  app.get("/api/state", authenticated, async (req, res) =>
    res.json(visibleState(await readAuthorized(req), req.user)),
  );
  app.get("/api/track/:token", async (req, res) => {
    identifier(req.params.token, "Tracking token", 128);
    const s = req.user
      ? visibleState(await readAuthorized(req), req.user)
      : await store.read();
    const b = s.bookings.find((b) => b.token === req.params.token);
    if (!b) return res.status(404).json({ error: "Booking not found." });
    if (req.user && !["Admin", "Client"].includes(req.user.role))
      return res.status(404).json({ error: "Booking not found." });
    if (req.user && req.user.role === "Client" && b.clientId !== req.user.id)
      return res.status(404).json({ error: "Booking not found in your account." });
    const project = s.projects.find((p) => p.bookingId === b.id),
      quotation = s.quotations.find(
        (q) =>
          q.bookingId === b.id &&
          !["Initial Estimate", "Under Review"].includes(q.status),
      );
    res.json({
      booking: b,
      inspections: s.inspections.filter((i) => i.bookingId === b.id),
      quotation,
      project,
      foreman: s.users.find((u) => u.id === project?.foremanId) || null,
      tasks: s.tasks.filter((t) => t.projectId === project?.id),
      payments: s.payments.filter((p) => p.projectId === project?.id),
      feedback: s.feedback.find((f) => f.projectId === project?.id),
      balance: project ? balance(s, project) : null,
    });
  });
  app.get("/api/personnel/:id", authenticated, async (req, res) => {
    identifier(req.params.id, "Personnel ID");
    const u = visibleState(await readAuthorized(req), req.user).users.find(
      (u) => u.id === req.params.id && u.role === "Foreman",
    );
    if (!u) return res.status(404).json({ error: "Personnel not found." });
    const { id, name, role, contact, initials, photo } = u;
    res.json({ id, name, role, contact, initials, photo });
  });
  app.post("/api/action", async (req, res) => {
    try {
      if (
        typeof req.body.action !== "string" ||
        !req.body.data ||
        typeof req.body.data !== "object" ||
        Array.isArray(req.body.data)
      )
        return res.status(400).json({ error: "Invalid action request." });
      const result = await store.transaction(async (s, connection) => {
        if (req.body.action !== "book" && !req.user)
          throw Object.assign(new Error("Please sign in."), { status: 401 });
        if (req.user) await authorizeSession(connection, req, s);
        return apply(s, req.body.action, req.body.data, req.user || {});
      });
      res.json(result);
    } catch (e) {
      res.status(e.status || (e.code ? 500 : 400)).json({
        field: e.field,
        error: e.code
          ? "Database operation failed; no changes were saved."
          : e.message,
      });
    }
  });
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use((err, req, res, next) =>
    res.status(err.status || 500).json({
      error:
        err instanceof ValidationError
          ? err.message
          : err.type === "entity.too.large"
            ? "Request is too large."
            : "Request could not be processed.",
    }),
  );
  return app;
}
