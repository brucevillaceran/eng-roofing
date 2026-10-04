import express from "express";
import { createServer as createViteServer } from "vite";
import { createStore } from "./store.js";
import { apply, balance } from "./domain.js";
const app = express(),
  store = createStore();
app.use(express.json({ limit: "12mb" }));
const actor = (req) => {
  const s = store.read();
  return (
    s.users.find((u) => u.id === req.headers["x-demo-user"]) || {
      role: "Guest",
    }
  );
};
app.get("/api/health", (_, res) => res.json({ ok: true }));
app.get("/api/state", (req, res) => {
  const s = store.read();
  if (actor(req).role === "Guest")
    return res.json(Object.fromEntries(Object.keys(s).map((key) => [key, []])));
  res.json({
    ...s,
    users: s.users.map(({ descriptor, ...u }) => ({
      ...u,
      enrolled: !!descriptor,
    })),
  });
});
app.get("/api/track/:token", (req, res) => {
  const s = store.read(),
    b = s.bookings.find((b) => b.token === req.params.token);
  if (!b)
    return res.status(404).json({
      error: "Tracking link not found. Check your confirmation email.",
    });
  const p = s.projects.find((p) => p.bookingId === b.id),
    q = s.quotations.find(
      (q) =>
        q.bookingId === b.id &&
        !["Initial Estimate", "Under Review"].includes(q.status),
    ),
    f = s.users.find((u) => u.id === p?.foremanId);
  res.json({
    booking: b,
    quotation: q,
    project: p,
    foreman: f
      ? {
          id: f.id,
          name: f.name,
          role: f.role,
          contact: f.contact,
          initials: f.initials,
          photo: f.photo,
        }
      : null,
    tasks: s.tasks.filter((t) => t.projectId === p?.id),
    payments: s.payments.filter((x) => x.projectId === p?.id),
    feedback: s.feedback.find((x) => x.projectId === p?.id),
    balance: p ? balance(s, p) : null,
  });
});
app.get("/api/personnel/:id", (req, res) => {
  const u = store
    .read()
    .users.find((u) => u.id === req.params.id && u.role === "Foreman");
  if (!u) return res.status(404).json({ error: "Personnel not found" });
  res.json({
    name: u.name,
    role: u.role,
    contact: u.contact,
    id: u.id,
    initials: u.initials,
    photo: u.photo,
  });
});
app.post("/api/action", (req, res) => {
  try {
    const s = store.read();
    const result = apply(s, req.body.action, req.body.data || {}, actor(req));
    store.save(s);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("/{*path}", (_, res) =>
    res.sendFile(`${process.cwd()}/dist/index.html`),
  );
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(3000, "0.0.0.0", () =>
  console.log("ENG Roofing ready on http://localhost:3000"),
);
