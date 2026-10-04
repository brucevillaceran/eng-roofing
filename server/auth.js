import { models, decode } from "./database-model.js";
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
export async function authorizeSession(connection, req, state) {
  const [[session]] = await connection.execute(
    "SELECT * FROM sessions WHERE tokenHash=? AND expires>?",
    [req.sessionHash || "", Date.now()],
  );
  const user = state.users.find(
    (u) =>
      u.id === session?.userId &&
      u.active !== false &&
      roles.includes(u.role) &&
      u.sessionVersion === session.version,
  );
  if (!user) throw Object.assign(new Error("Please sign in."), { status: 401 });
  if (
    req.headers["x-csrf-token"] !== session.csrf &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
  )
    throw Object.assign(new Error("Session verification failed."), {
      status: 403,
    });
  req.user = user;
}
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
  app.use("/api", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const raw = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("eng_session="))
      ?.slice(12);
    req.sessionHash = raw ? digest(raw) : null;
    if (req.sessionHash) {
      const [[session]] = await db.execute(
        "SELECT * FROM sessions WHERE tokenHash=? AND expires>?",
        [req.sessionHash, Date.now()],
      );
      if (session) {
        const [[row]] = await db.execute("SELECT * FROM users WHERE id=?", [
          session.userId,
        ]);
        const user = row && decode(row, models.users);
        if (
          user &&
          user.active !== false &&
          roles.includes(user.role) &&
          user.sessionVersion === session.version
        ) {
          req.user = user;
          req.session = session;
        }
      }
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const protocols =
        process.env.NODE_ENV === "production"
          ? ["https:"]
          : ["http:", "https:"];
      if (
        !protocols.some(
          (protocol) =>
            req.headers.origin === `${protocol}//${req.headers.host}`,
        )
      )
        return res
          .status(403)
          .json({ error: "Request origin is not allowed." });
      if (
        req.user &&
        !["/auth/login", "/auth/register"].includes(req.path) &&
        req.headers["x-csrf-token"] !== req.session.csrf
      )
        return res.status(403).json({
          error: "Session verification failed. Reload and try again.",
        });
    }
    next();
  });
  async function startSession(user, connection, previousHash) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    await connection.execute(
      "DELETE FROM sessions WHERE expires<=? OR tokenHash=?",
      [Date.now(), previousHash || ""],
    );
    await connection.execute(
      "INSERT INTO sessions (tokenHash,userId,csrf,version,expires) VALUES(?,?,?,?,?)",
      [
        digest(token),
        user.id,
        csrf,
        user.sessionVersion || 0,
        Date.now() + 12 * 3600000,
      ],
    );
    return { token, user: safeUser(user), csrf };
  }
  const respond = (res, session, status = 200) => {
    cookie(res, session.token, 12 * 3600000);
    res.status(status).json({ user: session.user, csrf: session.csrf });
  };
  async function limited(req, res) {
    // The same database mutex makes the two quota counters atomic across processes.
    const allowed = await store.transaction(async (_s, connection) => {
      await connection.execute("DELETE FROM login_attempts WHERE expires<=?", [
        Date.now(),
      ]);
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
        const [[row]] = await connection.execute(
          "SELECT count FROM login_attempts WHERE `key`=?",
          [key],
        );
        if (row?.count >= limit) return false;
      }
      for (const [key] of keys)
        await connection.execute(
          "INSERT INTO login_attempts (`key`,count,expires) VALUES (?,1,?) ON DUPLICATE KEY UPDATE count=count+1",
          [key, Date.now() + 900000],
        );
      return true;
    });
    if (!allowed)
      res
        .set("Retry-After", "900")
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    return allowed;
  }
  app.get("/api/auth/me", (req, res) =>
    res.json(
      req.user
        ? { user: safeUser(req.user), csrf: req.session.csrf }
        : { user: null },
    ),
  );
  app.post("/api/auth/login", async (req, res) => {
    if (!(await limited(req, res))) return;
    const session = await store.transaction(async (s, connection) => {
      const user = s.users.find(
        (u) =>
          u.email?.toLowerCase() ===
          String(req.body.email || "")
            .trim()
            .toLowerCase(),
      );
      const valid = verifyPassword(
        req.body.password,
        user?.passwordHash || dummyHash,
      );
      if (
        !valid ||
        !user ||
        user.active === false ||
        !roles.includes(user.role)
      )
        return null;
      return startSession(user, connection, req.sessionHash);
    });
    if (!session)
      return res
        .status(401)
        .json({ error: "Invalid credentials or inactive account." });
    respond(res, session);
  });
  app.post("/api/auth/register", async (req, res) => {
    if (!(await limited(req, res))) return;
    try {
      const email = validEmail(req.body.email),
        passwordHash = hashPassword(req.body.password);
      if (
        typeof req.body.name !== "string" ||
        !req.body.name.trim() ||
        req.body.name.length > 150
      )
        throw new Error("Full name is required (maximum 150 characters).");
      const session = await store.transaction(
        (s) => {
          if (s.users.some((u) => u.email?.toLowerCase() === email))
            throw new Error(
              "This email is already registered. Contact Admin if you need account access.",
            );
          const user = {
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
          s.users.push(user);
          return user;
        },
        (user, connection) => startSession(user, connection, req.sessionHash),
      );
      respond(res, session, 201);
    } catch (error) {
      res.status(error.code ? 500 : 400).json({
        error: error.code ? "Account could not be saved." : error.message,
      });
    }
  });
  app.post("/api/auth/logout", async (req, res) => {
    if (req.sessionHash)
      await db.execute("DELETE FROM sessions WHERE tokenHash=?", [
        req.sessionHash,
      ]);
    cookie(res, "", 0);
    res.json({ ok: true });
  });
}
export function authenticated(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please sign in." });
  next();
}
