import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
export function databaseConfig(overrides = {}) {
  const driver = process.env.DB_DRIVER || "mysql";
  if (!["mysql", "mariadb"].includes(driver))
    throw new Error("DB_DRIVER must be mysql or mariadb.");
  const port = Number(process.env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid DB_PORT.");
  return {
    host: process.env.DB_HOST || "localhost",
    port,
    database: process.env.DB_NAME || "eng_roofing",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 100,
    ...overrides,
  };
}
export function createPool(overrides) {
  const pool = mysql.createPool(databaseConfig(overrides));
  pool.on("connection", (connection) => {
    // Queue initialization before the connection's first application statement.
    connection.query(
      "SET SESSION sql_mode='STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION', time_zone='+00:00'",
      (error) => {
        if (error) connection.destroy();
      },
    );
  });
  return pool;
}
export async function initializeSchema(pool) {
  const sql = await readFile(
    new URL("../database/schema.sql", import.meta.url),
    "utf8",
  );
  // The checked-in schema deliberately contains no routines or delimiter changes.
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
}
