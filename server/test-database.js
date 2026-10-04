// Integration tests use randomly named real databases, never DB_NAME.
import { after } from "node:test";
import { randomUUID } from "node:crypto";
import { createPool, initializeSchema } from "./database.js";
import { createStore as openStore } from "./store.js";
import { seed } from "./seed.js";
const databases = new Map(),
  stores = [];
export async function createStore(key = ":memory:", { sample = false } = {}) {
  if (key === ":memory:") key = randomUUID();
  let database = databases.get(key);
  if (!database) {
    database = `eng_roofing_test_${randomUUID().replaceAll("-", "")}`;
    const pool = createPool({ database: undefined });
    try {
      await pool.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
    } finally {
      await pool.end();
    }
    databases.set(key, database);
    const pool2 = createPool({ database });
    try {
      await initializeSchema(pool2);
    } finally {
      await pool2.end();
    }
  }
  const store = await openStore({ database });
  stores.push(store);
  store.testConfig = { database };
  if (sample && !(await store.read()).users.length)
    await store.transaction((s) => {
      const fixture = seed();
      for (const u of fixture.users) {
        u.active = true;
        u.sessionVersion = 0;
      }
      for (const b of fixture.bookings) {
        const user = fixture.users.find(
          (u) => u.role === "Client" && u.email === b.email,
        );
        if (user) b.clientId = user.id;
      }
      fixture.notifications = [];
      Object.assign(s, fixture);
    });
  return store;
}
after(async () => {
  for (const store of stores) await store.close();
  const pool = createPool({ database: undefined });
  try {
    for (const database of databases.values())
      await pool.query(`DROP DATABASE \`${database}\``);
  } finally {
    await pool.end();
  }
});
