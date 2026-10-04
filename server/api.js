import express from "express";
import { apply, balance } from "./domain.js";
import { configureAuth, authenticated } from "./auth.js";
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
  app.get("/api/health", (_, res) => res.json({ ok: true }));
  app.get("/api/state", authenticated, (req, res) =>
    res.json(visibleState(store.read(), req.user)),
  );
  app.get("/api/track/:token", authenticated, (req, res) => {
    const s = visibleState(store.read(), req.user),
      b = s.bookings.find((b) => b.token === req.params.token);
    if (!b || !["Admin", "Client"].includes(req.user.role))
      return res
        .status(404)
        .json({ error: "Booking not found in your account." });
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
  app.get("/api/personnel/:id", authenticated, (req, res) => {
    const u = visibleState(store.read(), req.user).users.find(
      (u) => u.id === req.params.id && u.role === "Foreman",
    );
    if (!u) return res.status(404).json({ error: "Personnel not found." });
    const { id, name, role, contact, initials, photo } = u;
    res.json({ id, name, role, contact, initials, photo });
  });
  app.post("/api/action", authenticated, (req, res) => {
    try {
      if (
        typeof req.body.action !== "string" ||
        !req.body.data ||
        typeof req.body.data !== "object" ||
        Array.isArray(req.body.data)
      )
        return res.status(400).json({ error: "Invalid action request." });
      const s = store.read(),
        result = apply(s, req.body.action, req.body.data, req.user);
      store.save(s);
      res.json(result);
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message });
    }
  });
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use((err, req, res, next) =>
    res.status(err.status || 500).json({
      error:
        err.type === "entity.too.large"
          ? "Request is too large."
          : "Request could not be processed.",
    }),
  );
  return app;
}
