// Explicit local operator command: creates or recovers an administrator.
import { createStore } from "./store.js";
import { hashPassword, validEmail } from "./auth.js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const [emailArg, name] = process.argv.slice(2);
if (!emailArg || !name || process.stdin.isTTY) {
  console.error(
    'Usage: npm run admin -- "email" "Full name" < /path/to/private/password-file',
  );
  process.exit(1);
}
const email = validEmail(emailArg),
  passwordHash = hashPassword(readFileSync(0, "utf8").replace(/\r?\n$/, ""));
const store = await createStore();
try {
  await store.transaction(async (s) => {
    let u = s.users.find((u) => u.email.toLowerCase() === email);
    if (u && u.role !== "Admin")
      throw new Error(
        "This email belongs to a different role. Use account management.",
      );
    if (!u) {
      u = {
        id: `USR-${randomUUID()}`,
        role: "Admin",
        email,
        rate: 0,
        contact: "",
        photo: "",
      };
      s.users.push(u);
    }
    Object.assign(u, {
      name,
      passwordHash,
      active: true,
      sessionVersion: (u.sessionVersion || 0) + 1,
    });
  });
  console.log("Administrator account saved. Existing sessions invalidated.");
} finally {
  await store.close();
}
