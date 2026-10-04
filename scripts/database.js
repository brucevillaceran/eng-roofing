import { createPool, initializeSchema } from "../server/database.js";
const db = createPool();
try {
  if (process.argv[2] === "init") await initializeSchema(db);
  const [[row]] = await db.query(
    "SELECT DATABASE() AS databaseName, VERSION() AS version",
  );
  await db.query("SELECT revision FROM app_state WHERE id=1");
  console.log(
    `Connected to ${row.databaseName} (${row.version}). Schema ready.`,
  );
} catch (error) {
  console.error(`Database check failed: ${error.code || error.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
