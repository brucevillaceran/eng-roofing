// Explicit relational mapping. JSON stores variable-length inspection details,
// material snapshots, media/biometrics and key-presence metadata.
const fields = (definition) =>
  Object.fromEntries(
    definition
      .split(/\s+/)
      .filter(Boolean)
      .map((item) => {
        const [name, type = "text"] = item.split(":");
        return [name, type];
      }),
  );
export const models = Object.fromEntries(
  Object.entries({
    users:
      "name email:email contact initials role:role rate:number active:bool sessionVersion:int passwordHash photo:long descriptor:json",
    materials: "name unit price:number category thickness profile active:bool",
    bookings:
      "clientId:ref-users name email phone address date:date time service type description status submitted_at:instant token:token photos:json",
    inspections:
      "bookingId:ref-bookings foremanId:ref-users serviceType date:date status area:number linear:number sections:int profile complexity condition notes clientNotes accessories:json photos:json items:json details:json",
    quotations:
      "bookingId:ref-bookings inspectionId:ref-inspections charges:number total:number downpayment:number status notes createdAt:instant",
    projects:
      "bookingId:ref-bookings quotationId:ref-quotations name client service type address status progress:number start:date end:date foremanId:ref-users requirements:bool locked:bool createdAt:instant",
    tasks:
      "projectId:ref-projects name assigneeId:ref-users start:date due:date progress:number notes required:bool",
    usage:
      "projectId:ref-projects materialId:ref-materials used:number delivered:number",
    attendance:
      "userId:ref-users projectId:ref-projects date:date checkIn:instant checkOut:instant hours:number latitude:number longitude:number checkOutLatitude:number checkOutLongitude:number verified:bool source foremanId:ref-users checkOutForemanId:ref-users createdAt:instant updatedAt:instant",
    payroll:
      "userId:ref-users from:date to:date days:number hours:number workedHours:number rate:number gross:number deductions:number net:number status createdAt:instant releasedAt:instant correctionReason",
    payments:
      "projectId:ref-projects amount:number method date:date reference remarks createdAt:instant updatedAt:instant",
    feedback:
      "projectId:ref-projects name installation:int service:int timeliness:int professionalism:int comments createdAt:instant reviewNotes reviewedAt:instant",
    notifications:
      "userId:ref-users role:role title message createdAt:instant read:bool",
    emails: "to subject message path createdAt:instant status",
    settings: "name hoursPerDay:number currency payrollNote",
    userPayrollArchive:
      "userId:ref-users role:role rate:number descriptor:json archivedAt:instant",
  }).map(([table, def]) => [table, fields(def)]),
);
export const children = [
  [
    "quotations",
    "items",
    "quotation_materials",
    "quotationId",
    "materialId:ref-materials name unit quantity:number price:number",
  ],
  [
    "projects",
    "employeeIds",
    "project_employees",
    "projectId",
    "userId:ref-users",
    "userId",
  ],
  [
    "payroll",
    "attendanceIds",
    "payroll_attendance",
    "payrollId",
    "attendanceId:ref-attendance",
    "attendanceId",
  ],
  [
    "projects",
    "timeline",
    "project_progress",
    "projectId",
    "text at:instant actorId:ref-users progress:number",
  ],
  [
    "materials",
    "history",
    "material_history",
    "materialId",
    "at:instant price:number unit name newPrice:number note",
  ],
  [
    "attendance",
    "corrections",
    "attendance_corrections",
    "attendanceId",
    "previousHours:number hours:number reason actorId:ref-users at:instant",
  ],
  [
    "payroll",
    "adjustments",
    "payroll_adjustments",
    "payrollId",
    "previousDeductions:number deductions:number reason actorId:ref-users at:instant",
  ],
  [
    "payments",
    "annotations",
    "payment_annotations",
    "paymentId",
    "previousRemarks remarks actorId:ref-users at:instant",
  ],
].map(([parent, property, table, parentKey, def, scalar]) => ({
  parent,
  property,
  table,
  parentKey,
  fields: fields(def),
  scalar,
}));
export const tables = Object.keys(models);
export const quote = (name) => "`" + name + "`";
// Keep application/legacy collection names stable while SQL names stay portable.
export const tableName = (name) =>
  name === "userPayrollArchive" ? "userpayrollarchive" : name;
export const quoteTable = (name) => quote(tableName(name));
export const defaultSettings = {
  id: "company",
  name: "ENG Roofing Supply & Installation Services",
  hoursPerDay: 8,
  currency: "PHP",
  payrollNote:
    "Daily rate prorated by verified hours, capped at eight hours per day. Enter approved deductions.",
};
export function encode(record, definition, additional = []) {
  const allowed = new Set(["id", ...Object.keys(definition), ...additional]);
  for (const key of Object.keys(record))
    if (!allowed.has(key)) throw new Error(`Unmapped database field: ${key}`);
  const shape = Object.keys(record).filter((key) => record[key] !== undefined);
  const values = Object.entries(definition).map(([key, type]) => {
    const value = record[key];
    if (value === undefined || value === null) return null;
    if (
      (type.startsWith("ref-") || type === "date" || type === "instant") &&
      value === ""
    ) {
      shape.push(key + "=");
      return null;
    }
    if (type === "json") return JSON.stringify(value);
    if (type === "bool") return value ? 1 : 0;
    if (type === "instant") {
      if (!Number.isFinite(Date.parse(value)))
        throw new Error(`Invalid timestamp: ${key}`);
      return new Date(value).toISOString().replace("T", " ").replace("Z", "");
    }
    return value;
  });
  return [...values, JSON.stringify(shape)];
}
export function decode(row, definition) {
  const shape =
    typeof row._fields === "string" ? JSON.parse(row._fields) : row._fields;
  const out = row.id ? { id: row.id } : {};
  for (const [key, type] of Object.entries(definition)) {
    if (!shape.includes(key)) continue;
    let value = row[key];
    if (shape.includes(key + "=")) value = "";
    else if (value !== null) {
      if (type === "json" && typeof value === "string")
        value = JSON.parse(value);
      if (type === "bool") value = !!value;
      if (type === "instant")
        value = new Date(value.replace(" ", "T") + "Z").toISOString();
    }
    out[key] = value;
  }
  return out;
}
