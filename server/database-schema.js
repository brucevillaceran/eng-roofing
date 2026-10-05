import { columnUpgrades } from "./schema-upgrades.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { models, children, tableName, quote } from "./database-model.js";

// Model-driven inventory includes history/link tables and direct auth SQL.
export const requiredSchema = {
  ...Object.fromEntries(
    Object.entries(models).map(([name, fields]) => [
      tableName(name),
      ["id", "_position", ...Object.keys(fields), "_fields"],
    ]),
  ),
  ...Object.fromEntries(
    children.map((c) => [
      c.table,
      [c.parentKey, "_position", ...Object.keys(c.fields), "_fields"],
    ]),
  ),
  sessions: ["tokenHash", "userId", "csrf", "version", "expires"],
  login_attempts: ["key", "count", "expires"],
  migrations: ["id", "details"],
  app_state: ["id", "revision"],
};

async function inventory(connection) {
  const [[config]] = await connection.query(
    "SELECT DATABASE() AS databaseName, @@lower_case_table_names AS lowerCaseNames",
  );
  if (!config.databaseName) throw new Error("Select DB_NAME in .env");
  const [rows] = await connection.execute(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?",
    [config.databaseName],
  );
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.TABLE_NAME)) tables.set(row.TABLE_NAME, new Set());
    tables.get(row.TABLE_NAME).add(row.COLUMN_NAME.toLowerCase());
  }
  return { ...config, tables };
}
function matchingTables(info, name) {
  return [...info.tables.keys()].filter(
    (actual) => actual.toLowerCase() === name.toLowerCase(),
  );
}
function problems(
  info,
  {
    allowMissing = false,
    allowArchiveRename = false,
    allowUpgrades = false,
  } = {},
) {
  const errors = [];
  for (const [table, columns] of Object.entries(requiredSchema)) {
    const matches = matchingTables(info, table);
    if (!matches.length) {
      if (!allowMissing) errors.push(`missing table ${table}`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(
        `ambiguous table names ${matches.join(" / ")}; preserve both and resolve the duplicate before retrying`,
      );
      continue;
    }
    const actual = matches[0];
    if (
      !info.lowerCaseNames &&
      actual !== table &&
      !(allowArchiveRename && table === "userpayrollarchive")
    )
      errors.push(`table ${actual} must be named ${table}`);
    for (const column of columns)
      if (
        !info.tables.get(actual).has(column.toLowerCase()) &&
        !(allowUpgrades && columnUpgrades[table]?.[column])
      )
        errors.push(`missing column ${actual}.${column}`);
  }
  return errors;
}
function assertSchema(errors) {
  if (errors.length)
    throw new Error(
      `Database schema is incomplete: ${errors.join("; ")}. Run npm run db:init; incompatible existing tables require an explicit schema repair, not a database reset`,
    );
}
async function ensureInspectionMaterials(connection) {
  const standardMaterials = [
    ["Banawe", "SQM", 500, "Roofing Sheet", "0.40 mm", "Rib-Type / Ribbed"],
    ["Twin Rib", "SQM", 550, "Roofing Sheet", "0.40 mm", "Rib-Type / Ribbed"],
    ["Tilespan", "SQM", 600, "Roofing Sheet", "0.40 mm", "Tile Profile"],
    ["R-Span", "SQM", 750, "Roofing Sheet", "0.50 mm", "R-Span"],
    ["Standing Seam", "SQM", 800, "Roofing Sheet", "0.50 mm", "Standing Seam"],
    ["Steel Decking", "SQM", 850, "Roofing Sheet", "0.80 mm", "Metal Deck"],
    ["Curve Roof", "SQM", 850, "Roofing Sheet", "0.50 mm", "Curved Roof"],
    ["Tile Profile", "SQM", 900, "Roofing Sheet", "0.50 mm", "Tile Profile"],
    ["Ridge Cap", "LM", 250, "Accessory", "—", "Other"],
    ["Flashing", "LM", 300, "Accessory", "—", "Other"],
    ["Valley Flashing", "LM", 350, "Accessory", "—", "Other"],
    ["Eaves Flashing", "LM", 250, "Accessory", "—", "Other"],
    ["Barge/Side Flashing", "LM", 300, "Accessory", "—", "Other"],
    ["Roofing Screws", "PCS", 5, "Accessory", "—", "Other"],
    ["Sealant", "TUBE", 220, "Accessory", "—", "Other"],
    ["Closure Strips", "PCS", 80, "Accessory", "—", "Other"],
    ["Gutter", "LM", 500, "Accessory", "—", "Other"],
    ["Downspout", "LM", 400, "Accessory", "—", "Other"],
  ];
  await connection.beginTransaction();
  try {
    for (const [
      name,
      unit,
      price,
      category,
      thickness,
      profile,
    ] of standardMaterials) {
      const [existing] = await connection.execute(
        "SELECT id FROM materials WHERE name=? LIMIT 1",
        [name],
      );
      if (existing.length) continue;
      const [[position]] = await connection.query(
        "SELECT COALESCE(MAX(_position), -1) + 1 AS nextPosition FROM materials",
      );
      const id = `MAT-STD-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
      await connection.execute(
        "INSERT INTO materials (id, _position, name, unit, price, category, thickness, profile, active, _fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
        [
          id,
          position.nextPosition,
          name,
          unit,
          price,
          category,
          thickness,
          profile,
          JSON.stringify([
            "id",
            "name",
            "unit",
            "price",
            "category",
            "thickness",
            "profile",
            "active",
          ]),
        ],
      );
    }
    const [closureRows] = await connection.execute(
      "SELECT id, name, unit, price FROM materials WHERE name='Closure Strips' AND unit<>'PCS'",
    );
    for (const material of closureRows) {
      const [[historyPosition]] = await connection.execute(
        "SELECT COALESCE(MAX(_position), -1) + 1 AS nextPosition FROM material_history WHERE materialId=?",
        [material.id],
      );
      await connection.execute(
        "INSERT INTO material_history (materialId, _position, `at`, price, unit, name, newPrice, note, _fields) VALUES (?, ?, UTC_TIMESTAMP(3), ?, ?, ?, ?, ?, ?)",
        [
          material.id,
          historyPosition.nextPosition,
          material.price,
          material.unit,
          material.name,
          material.price,
          "Standard inspection unit corrected to PCS",
          JSON.stringify(["at", "price", "unit", "name", "newPrice", "note"]),
        ],
      );
      await connection.execute("UPDATE materials SET unit='PCS' WHERE id=?", [
        material.id,
      ]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
export async function checkSchema(pool) {
  const connection = await pool.getConnection();
  try {
    const info = await inventory(connection);
    assertSchema(problems(info));
    const [[state]] = await connection.query(
      "SELECT revision FROM app_state WHERE id=1",
    );
    if (!state)
      throw new Error("Missing app_state revision row. Run npm run db:init");
    return {
      databaseName: info.databaseName,
      tables: Object.keys(requiredSchema).length,
    };
  } finally {
    connection.release();
  }
}
async function definitions() {
  const sql = await readFile(
    new URL("../database/schema.sql", import.meta.url),
    "utf8",
  );
  // This schema has only line comments, CREATE TABLEs and the app_state insert.
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const creates = new Map();
  for (const statement of statements) {
    const match = /^CREATE TABLE IF NOT EXISTS `([a-z_]+)`\s*\(/.exec(
      statement,
    );
    if (match) creates.set(match[1], statement);
    else if (!statement.startsWith("INSERT INTO app_state "))
      throw new Error("Unsupported statement in database/schema.sql");
  }
  const missing = Object.keys(requiredSchema).filter(
    (name) => !creates.has(name),
  );
  const extra = [...creates.keys()].filter((name) => !requiredSchema[name]);
  if (missing.length || extra.length)
    throw new Error(
      `Schema/model mismatch: missing ${missing.join(", ") || "none"}; unexpected ${extra.join(", ") || "none"}`,
    );
  return creates;
}
export async function initializeSchema(pool) {
  const creates = await definitions();
  const connection = await pool.getConnection();
  let lock;
  try {
    let info = await inventory(connection);
    lock = `eng-schema-${createHash("sha256").update(info.databaseName).digest("hex").slice(0, 48)}`;
    const [[result]] = await connection.execute(
      "SELECT GET_LOCK(?, 30) AS acquired",
      [lock],
    );
    if (Number(result.acquired) !== 1) {
      lock = undefined;
      throw new Error("Database schema upgrade is busy; retry startup shortly");
    }
    info = await inventory(connection);
    // DDL auto-commits: inspect existing tables before making any changes.
    assertSchema(
      problems(info, {
        allowMissing: true,
        allowArchiveRename: true,
        allowUpgrades: true,
      }),
    );
    const [archive] = matchingTables(info, "userpayrollarchive");
    if (archive && !info.lowerCaseNames && archive !== "userpayrollarchive") {
      await connection.query(
        `RENAME TABLE ${quote(archive)} TO userpayrollarchive`,
      );
      info.tables.set("userpayrollarchive", info.tables.get(archive));
      info.tables.delete(archive);
    }
    // Only missing tables are created, in schema FK order. Existing rows,
    // columns, indexes and constraints are never overwritten or dropped.
    for (const [table, statement] of creates)
      if (!matchingTables(info, table).length)
        await connection.query(statement);
    info = await inventory(connection);
    for (const [table, upgrades] of Object.entries(columnUpgrades))
      for (const [column, sql] of Object.entries(upgrades))
        if (!info.tables.get(table).has(column.toLowerCase()))
          await connection.query(`ALTER TABLE ${quote(table)} ${sql}`);
    assertSchema(problems(await inventory(connection)));
    await ensureInspectionMaterials(connection);
    const [[state]] = await connection.query(
      "SELECT revision FROM app_state WHERE id=1",
    );
    if (!state)
      await connection.query(
        "INSERT INTO app_state (id, revision) VALUES (1, 0) ON DUPLICATE KEY UPDATE id=id",
      );
  } finally {
    try {
      if (lock) await connection.execute("SELECT RELEASE_LOCK(?)", [lock]);
    } finally {
      connection.release();
    }
  }
}
