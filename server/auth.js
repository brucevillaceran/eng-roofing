import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export const roles = ["Admin", "Foreman", "Employee", "Client"];
export function validEmail(value) {
  if (
    typeof value !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    value.length > 254
  )
    throw new Error("Enter a valid email address.");
  return value.trim().toLowerCase();
}
export function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("Password must contain 12 to 128 characters.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, hash) {
  if (typeof password !== "string" || password.length > 128 || !hash)
    return false;
  const [salt, encoded] = hash.split(":");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "hex"),
    actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const safeUser = ({
  passwordHash,
  descriptor,
  sessionVersion,
  ...user
}) => ({ ...user, enrolled: !!descriptor });
const digest = (value) => createHash("sha256").update(value).digest("hex");
const dummyHash = hashPassword(randomBytes(24).toString("hex"));
export function configureAuth(app, store) {
  const db = store.db;
  const cookie = (res, value, age) =>
    res.cookie("eng_session", value, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: age,
    });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const raw = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("eng_session="))
      ?.slice(12);
    req.sessionHash = raw ? digest(raw) : null;
    const session =
      req.sessionHash &&
      db
        .prepare("SELECT * FROM sessions WHERE tokenHash = ? AND expires > ?")
        .get(req.sessionHash, Date.now());
    const user =
      session &&
      store
        .read()
        .users.find(
          (u) =>
            u.id === session.userId &&
            u.active !== false &&
            roles.includes(u.role) &&
            u.sessionVersion === session.version,
        );
    if (user) {
      req.user = user;
      req.session = session;
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        !origin ||
        !(
          process.env.NODE_ENV === "production"
            ? ["https:"]
            : ["http:", "https:"]
        ).some((protocol) => origin === `${protocol}//${req.headers.host}`)
      )
        return res
          .status(403)
          .json({ error: "Request origin is not allowed." });
      if (
        req.user &&
        !["/auth/login", "/auth/register"].includes(req.path) &&
        req.headers["x-csrf-token"] !== session.csrf
      )
        return res.status(403).json({
          error: "Session verification failed. Reload and try again.",
        });
    }
    next();
  });
  const startSession = (user, res) => {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?)").run(
      digest(token),
      user.id,
      csrf,
      user.sessionVersion || 0,
      Date.now() + 12 * 3600000,
    );
    cookie(res, token, 12 * 3600000);
    return { user: safeUser(user), csrf };
  };
  const limited = (req, res) => {
    db.prepare("DELETE FROM login_attempts WHERE expires <= ?").run(Date.now());
    const keys = [
      [digest(`ip:${req.socket.remoteAddress}`), 60],
      [
        digest(
          `account:${req.socket.remoteAddress}:${String(req.body.email || "")
            .trim()
            .toLowerCase()}`,
        ),
        10,
      ],
    ];
    for (const [key, limit] of keys) {
      const previous = db
        .prepare("SELECT * FROM login_attempts WHERE key=?")
        .get(key);
      if (previous?.count >= limit) {
        res.set("Retry-After", "900");
        res
          .status(429)
          .json({ error: "Too many attempts. Try again in 15 minutes." });
        return false;
      }
    }
    for (const [key] of keys)
      db.prepare(
        "INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
      ).run(key, Date.now() + 900000);
    return true;
  };
  app.get("/api/auth/me", (req, res) =>
    res.json(
      req.user
        ? { user: safeUser(req.user), csrf: req.session.csrf }
        : { user: null },
    ),
  );
  app.post("/api/auth/login", (req, res) => {
    if (!limited(req, res)) return;
    const u = store.read().users.find(
      (u) =>
        u.email?.toLowerCase() ===
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
    );
    const valid = verifyPassword(
      req.body.password,
      u?.passwordHash || dummyHash,
    );
    if (!valid || !u || u.active === false || !roles.includes(u.role))
      return res
        .status(401)
        .json({ error: "Invalid credentials or inactive account." });
    if (req.sessionHash)
      db.prepare("DELETE FROM sessions WHERE tokenHash=?").run(req.sessionHash);
    res.json(startSession(u, res));
  });
  app.post("/api/auth/register", (req, res) => {
    if (!limited(req, res)) return;
    try {
      const s = store.read(),
        email = validEmail(req.body.email),
        passwordHash = hashPassword(req.body.password);
      if (s.users.some((u) => u.email?.toLowerCase() === email))
        throw new Error(
          "This email is already registered. Contact Admin if you need account access.",
        );
      if (
        typeof req.body.name !== "string" ||
        !req.body.name.trim() ||
        req.body.name.length > 150
      )
        throw new Error("Full name is required (maximum 150 characters).");
      const u = {
        id: `USR-${randomUUID()}`,
        name: req.body.name.trim(),
        email,
        contact: String(req.body.contact || "").slice(0, 100),
        role: "Client",
        active: true,
        passwordHash,
        sessionVersion: 0,
        rate: 0,
        photo: "",
      };
      s.users.push(u);
      store.save(s);
      if (req.sessionHash)
        db.prepare("DELETE FROM sessions WHERE tokenHash=?").run(
          req.sessionHash,
        );
      res.status(201).json(startSession(u, res));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    if (req.sessionHash)
      db.prepare("DELETE FROM sessions WHERE tokenHash=?").run(req.sessionHash);
    cookie(res, "", 0);
    res.json({ ok: true });
  });
}
export function authenticated(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please sign in." });
  next();
}
