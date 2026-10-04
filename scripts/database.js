import {
  createPool,
  initializeSchema,
  checkSchema,
} from "../server/database.js";
const db = createPool();
try {
  if (process.argv[2] === "init") await initializeSchema(db);
  const [[row]] = await db.query(
    "SELECT DATABASE() AS databaseName, VERSION() AS version",
  );
  const schema = await checkSchema(db);
  console.log(
    `Connected to ${row.databaseName} (${row.version}). Schema ready (${schema.tables} tables and their required columns checked).`,
  );
} catch (error) {
  console.error(
    `Database check failed: ${error.code ? error.code + ": " : ""}${error.message}`,
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
