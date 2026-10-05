import { profiles, accessories } from "./roofing.js";
export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.status = 400;
  }
}
const fail = (field, message) => {
  throw new ValidationError(field, message);
};
export const roles = ["Admin", "Foreman", "Employee", "Client"];
export const limits = {
  text: 2000,
  name: 150,
  address: 500,
  price: 1000000,
  amount: 1000000000,
  rate: 100000,
  quantity: 1000000,
  measurement: 1000000,
  sections: 10000,
};
export const today = () => new Date().toISOString().slice(0, 10);
export function textValue(value, field, max = limits.text, required = true) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") fail(field, `${field}: enter text only.`);
  const result = value.trim();
  if (
    (required && !result) ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    fail(
      field,
      `${field}: enter ${required ? "1" : "0"}–${max} characters without control characters.`,
    );
  return result;
}
export function personName(value, field = "Full name") {
  const result = textValue(value, field, 150)
    .normalize("NFC")
    .replace(/ +/g, " ");
  if (!/^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$/u.test(result))
    fail(
      field,
      `${field}: use letters and spaces; a single hyphen or apostrophe may join parts of a name. Numbers are not allowed.`,
    );
  return result;
}
export function phoneNumber(value, field = "Contact number", required = true) {
  if (!required && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !/^09\d{9}$/.test(value))
    fail(
      field,
      `${field}: enter exactly 11 digits starting with 09, without spaces or symbols.`,
    );
  return value;
}
export function emailAddress(value, field = "Email") {
  const result = textValue(value, field, 254).toLowerCase(),
    parts = result.split("@");
  if (parts.length !== 2)
    fail(
      field,
      `${field}: enter a valid email address, such as name@example.com.`,
    );
  const [local, domain] = parts;
  if (
    local.length > 64 ||
    !local ||
    !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
  )
    fail(field, `${field}: enter a valid email address without spaces.`);
  return result;
}
export function numberValue(
  value,
  field,
  { min = 0, max = limits.amount, decimals = 2 } = {},
) {
  if (
    !["number", "string"].includes(typeof value) ||
    !new RegExp(`^-?\\d+(?:\\.\\d{1,${Math.max(decimals, 1)}})?$`).test(
      String(value),
    )
  )
    fail(
      field,
      `${field}: enter a number${decimals ? " with at most " + decimals + " decimal places" : ""}; do not use letters, spaces, commas, or symbols.`,
    );
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (decimals === 0 && !Number.isInteger(n))
  )
    fail(
      field,
      `${field}: enter ${decimals === 0 ? "a whole number" : "a number"} from ${min} to ${max}.`,
    );
  return n;
}
export function dateValue(
  value,
  field,
  { min = "2000-01-01", max = "2100-12-31", optional = false } = {},
) {
  if (optional && (value === undefined || value === "")) return "";
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(field, `${field}: enter a real date in YYYY-MM-DD format.`);
  if (value < min || value > max)
    fail(field, `${field}: choose a date from ${min} to ${max}.`);
  return value;
}
export function timeValue(value, field = "Time") {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail(field, `${field}: enter a valid 24-hour time (HH:MM).`);
  return value;
}
export function identifier(value, field = "Record", max = 64) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)
  )
    fail(field, `${field}: choose a valid record.`);
  return value;
}
export function choice(value, field, values) {
  if (!values.includes(value))
    fail(field, `${field}: choose one of ${values.join(", ")}.`);
  return value;
}
export function passwordValue(
  value,
  field = "Password",
  { optional = false, login = false } = {},
) {
  if (optional && (value === undefined || value === "")) return "";
  if (
    typeof value !== "string" ||
    value.length < (login ? 1 : 12) ||
    value.length > 128
  )
    fail(field, `${field}: enter ${login ? "1" : "12"}–128 characters.`);
  return value; // Never trim or normalize passwords.
}
export function faceDescriptor(value, field = "Face enrollment") {
  if (
    !Array.isArray(value) ||
    value.length !== 128 ||
    value.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 2,
    )
  )
    fail(
      field,
      `${field}: capture one clear face using the enrollment camera before saving.`,
    );
  return value;
}
export function photoValue(value, field = "Photo") {
  if (value === "") return "";
  if (typeof value !== "string" || value.length > 2000100)
    fail(
      field,
      `${field}: use a JPG, PNG, or WebP image no larger than 1.5 MB.`,
    );
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0)
    fail(field, `${field}: choose a valid JPG, PNG, or WebP image.`);
  let bytes;
  try {
    bytes = atob(match[2]);
  } catch {
    fail(field, `${field}: image data is invalid.`);
  }
  const valid =
    match[1] === "png"
      ? bytes.startsWith("\x89PNG\r\n\x1a\n")
      : match[1] === "jpeg"
        ? bytes.startsWith("\xff\xd8\xff")
        : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  if (!valid || bytes.length > 1500000)
    fail(field, `${field}: choose a valid image no larger than 1.5 MB.`);
  return value;
}
const object = (d, field) => {
  if (!d || typeof d !== "object" || Array.isArray(d))
    fail(field, `${field}: submit an object.`);
};
const keys = (d, allowed) => {
  object(d, "Form");
  for (const k of Object.keys(d))
    if (!allowed.includes(k) && d[k] !== undefined)
      fail(k, `${k}: this field cannot be changed in this form.`);
};
export function validateAuth(kind, input) {
  keys(
    input,
    kind === "register"
      ? ["name", "email", "contact", "password"]
      : ["email", "password"],
  );
  const d = {
    ...input,
    email: emailAddress(input.email),
    password: passwordValue(input.password, "Password", {
      login: kind === "login",
    }),
  };
  if (kind === "register") {
    d.name = personName(input.name);
    d.contact = phoneNumber(input.contact);
  }
  return d;
}
export const actionRoles = {
  book: ["Admin", "Client"],
  bookingOwner: ["Admin"],
  booking: ["Admin"],
  bookingDecision: ["Admin"],
  inspectionAssign: ["Admin"],
  inspection: ["Admin", "Foreman"],
  estimate: ["Admin", "Foreman"],
  finalize: ["Admin"],
  quoteDecision: ["Client"],
  project: ["Admin"],
  task: ["Admin", "Foreman"],
  usage: ["Admin", "Foreman"],
  payment: ["Admin"],
  complete: ["Admin", "Foreman"],
  feedback: ["Client"],
  material: ["Admin"],
  user: ["Admin"],
  profile: roles,
  progress: ["Admin", "Foreman"],
  attendanceUpdate: ["Admin"],
  paymentUpdate: ["Admin"],
  payrollUpdate: ["Admin"],
  feedbackReview: ["Admin"],
  notification: ["Admin"],
  enroll: ["Admin"],
  attendance: ["Foreman"],
  payroll: ["Admin"],
  payrollPaid: ["Admin"],
  read: roles,
  settings: ["Admin"],
};
const schemas = {
  book: "clientId name email phone address date time service type description photos",
  bookingOwner: "id clientId",
  booking: "id name phone address description date time",
  bookingDecision: "id status",
  inspectionAssign: "id foremanId date",
  inspection:
    "id date area linear sections profile complexity condition accessories notes clientNotes photos",
  estimate: "inspectionId items charges notes",
  finalize: "id items charges downpayment notes",
  quoteDecision: "id token status name",
  project: "id name foremanId employeeIds start end status",
  task: "id projectId name assigneeId start due progress notes required",
  usage: "id projectId delivered used",
  payment: "projectId amount method date reference remarks",
  complete: "id requirements",
  feedback:
    "projectId token installation service timeliness professionalism comments",
  material: "id name unit price category profile thickness active",
  user: "id name role email contact password rate descriptor photo active",
  profile: "name contact password currentPassword",
  progress: "projectId progress notes",
  attendanceUpdate: "id hours reason",
  paymentUpdate: "id remarks",
  payrollUpdate: "id deductions reason",
  feedbackReview: "id notes",
  notification: "userId title message",
  enroll: "userId descriptor",
  attendance:
    "projectId userId operation attendanceId descriptor latitude longitude",
  payroll: "userId from to deductions",
  payrollPaid: "id",
  read: "",
  settings: "name payrollNote",
};
export function validateAction(action, input, { state, user } = {}) {
  if (!Object.hasOwn(schemas, action)) fail("Action", "Choose a valid action.");
  keys(input, schemas[action].split(" "));
  const d = { ...input };
  const has = (k) => d[k] !== undefined;
  const str = (k, label, max = limits.text, required = true) => {
    d[k] = textValue(d[k], label, max, required);
  };
  const num = (k, label, options) => {
    d[k] = numberValue(d[k], label, options);
  };
  const date = (k, label, options) => {
    d[k] = dateValue(d[k], label, options);
  };
  const select = (k, label, values) => {
    d[k] = choice(d[k], label, values);
  };
  for (const k of [
    "id",
    "clientId",
    "inspectionId",
    "projectId",
    "userId",
    "assigneeId",
    "foremanId",
  ])
    if (has(k) && d[k] !== "") d[k] = identifier(d[k], k);
  if (has("token")) d.token = identifier(d.token, "Tracking token", 128);
  for (const k of [
    "notes",
    "clientNotes",
    "comments",
    "remarks",
    "description",
  ])
    if (has(k)) str(k, k, limits.text, false);
  if (has("name"))
    d.name = ["user", "profile", "book", "booking"].includes(action)
      ? personName(d.name)
      : textValue(d.name, action === "settings" ? "Company name" : "Name", 150);
  if (has("email")) d.email = emailAddress(d.email);
  for (const k of ["phone", "contact"]) if (has(k)) d[k] = phoneNumber(d[k]);
  if (has("address")) str("address", "Address", 500);
  if (has("photo")) d.photo = photoValue(d.photo);
  if (has("photos")) {
    if (!Array.isArray(d.photos) || d.photos.length > 5)
      fail("photos", "Choose up to 5 photos.");
    d.photos = d.photos.map((p, i) => photoValue(p, `Photo ${i + 1}`));
  }
  switch (action) {
    case "book":
      d.phone = phoneNumber(d.phone);
      str("address", "Address", 500);
      str("description", "Roofing concern");
      date("date", "Preferred date", { min: today() });
      d.time = timeValue(d.time, "Preferred time");
      select("service", "Service", [
        "Roof Installation",
        "Roof Replacement",
        "Roof Repair",
      ]);
      select("type", "Project type", [
        "Residential",
        "Commercial",
        "Industrial",
        "Institutional",
      ]);
      break;
    case "booking":
      if (has("date")) date("date", "Preferred date");
      if (has("time")) d.time = timeValue(d.time, "Preferred time");
      break;
    case "bookingDecision":
      select("status", "Booking decision", ["Approved", "Rejected"]);
      break;
    case "inspectionAssign":
      date("date", "Inspection date", { min: today() });
      break;
    case "inspection":
      date("date", "Inspection date", { max: today() });
      num("area", "Roof area", { min: 0.01, max: limits.measurement });
      num("linear", "Linear measurement", { max: limits.measurement });
      num("sections", "Roof sections", {
        min: 1,
        max: limits.sections,
        decimals: 0,
      });
      select("profile", "Roof profile", profiles);
      select("complexity", "Roof complexity", [
        "Simple",
        "Moderate",
        "Complex",
      ]);
      select("condition", "Condition", [
        "New / No Existing Structure",
        "Good",
        "Fair",
        "Needs Repair",
        "Damaged",
        "Severely Damaged",
        "Requires Further Assessment",
      ]);
      if (has("accessories")) {
        if (
          !Array.isArray(d.accessories) ||
          d.accessories.length > accessories.length ||
          new Set(d.accessories).size !== d.accessories.length
        )
          fail("accessories", "Select each accessory at most once.");
        d.accessories.forEach((a) => choice(a, "Accessory", accessories));
      }
      break;
    case "estimate":
    case "finalize":
      if (action === "estimate" || has("items")) {
        if (!Array.isArray(d.items) || !d.items.length || d.items.length > 200)
          fail("items", "Choose 1–200 quotation materials.");
        d.items = d.items.map((x, i) => {
          keys(x, ["materialId", "quantity"]);
          return {
            materialId: identifier(x.materialId, "Material"),
            quantity: numberValue(x.quantity, `Quantity on line ${i + 1}`, {
              min: 0.01,
              max: limits.quantity,
            }),
          };
        });
        if (new Set(d.items.map((x) => x.materialId)).size !== d.items.length)
          fail("items", "Select each material only once.");
      }
      if (has("charges")) num("charges", "Additional charges");
      if (has("downpayment")) num("downpayment", "Downpayment");
      break;
    case "quoteDecision":
      select("status", "Quotation decision", ["Approved", "Rejected"]);
      break;
    case "project":
      select("status", "Project status", [
        "Pending",
        "Approved",
        "Scheduled",
        "Ongoing",
        "On Hold",
        "Cancelled",
      ]);
      date("start", "Start date", {
        optional: !["Scheduled", "Ongoing"].includes(d.status),
      });
      date("end", "Completion date", {
        optional: !["Scheduled", "Ongoing"].includes(d.status),
      });
      if (
        d.employeeIds !== undefined &&
        (!Array.isArray(d.employeeIds) ||
          d.employeeIds.length > 1000 ||
          new Set(d.employeeIds).size !== d.employeeIds.length)
      )
        fail("employeeIds", "Select up to 1,000 different employees.");
      (d.employeeIds || []).forEach((id) => identifier(id, "Employee"));
      break;
    case "task":
      str("name", "Task name", 150);
      date("start", "Task start");
      date("due", "Task due date");
      num("progress", "Progress", { max: 100 });
      if (has("required") && typeof d.required !== "boolean")
        fail("required", "Choose whether the task is required.");
      break;
    case "usage":
      num("delivered", "Delivered quantity", { max: limits.quantity });
      num("used", "Used quantity", { max: limits.quantity });
      if (d.used > d.delivered)
        fail("used", "Usage cannot exceed delivered material.");
      break;
    case "payment":
      num("amount", "Payment amount", { min: 0.01 });
      select("method", "Payment method", [
        "Cash",
        "Bank Transfer",
        "GCash",
        "Check",
      ]);
      date("date", "Payment date", { max: today() });
      str("reference", "Reference number", 150);
      break;
    case "complete":
      if (d.requirements !== true)
        fail(
          "requirements",
          "Confirm the final inspection and project requirements.",
        );
      break;
    case "feedback":
      for (const k of [
        "installation",
        "service",
        "timeliness",
        "professionalism",
      ])
        num(k, `${k} rating`, { min: 1, max: 5, decimals: 0 });
      break;
    case "material":
      str("name", "Material name", 150);
      num("price", "Price", { max: limits.price });
      select("unit", "Unit", ["SQM", "LM", "PCS", "TUBE", "SET"]);
      select("category", "Category", ["Roofing Sheet", "Accessory"]);
      if (has("profile")) select("profile", "Roof profile", profiles);
      if (has("thickness")) {
        str("thickness", "Thickness", 30, false);
        if (d.thickness && !/^(?:\d+(?:\.\d{1,2})?\s*mm|—)$/.test(d.thickness))
          fail(
            "thickness",
            "Thickness: enter a measurement such as 0.40 mm, or leave blank.",
          );
        if (d.thickness && d.thickness !== "—")
          numberValue(d.thickness.replace(/\s*mm$/, ""), "Thickness", {
            min: 0.01,
            max: 100,
          });
      }
      if (has("active") && typeof d.active !== "boolean")
        fail("active", "Choose Active or Disabled.");
      break;
    case "user": {
      d.name = personName(d.name);
      d.email = emailAddress(d.email);
      d.contact = phoneNumber(d.contact);
      select("role", "Role", roles);
      if (
        has("active") &&
        ![true, false, "Active", "Inactive"].includes(d.active)
      )
        fail("active", "Choose Active or Inactive.");
      d.password = passwordValue(d.password, "Password", { optional: !!d.id });
      const existing = state?.users.find((u) => u.id === d.id);
      if (d.role === "Employee") {
        num("rate", "Daily rate", { min: 0.01, max: limits.rate });
        if (has("descriptor")) d.descriptor = faceDescriptor(d.descriptor);
        else if (existing?.role === "Employee" && existing.descriptor)
          faceDescriptor(existing.descriptor);
        else if (
          !existing ||
          existing.role !== "Employee" ||
          !(existing.descriptor || existing.enrolled)
        )
          fail(
            "descriptor",
            "Face enrollment is required for Employees. Capture a face before saving.",
          );
      } else if (has("rate") || has("descriptor"))
        fail(
          "role",
          "Daily rate and face enrollment apply only to Employees. Remove these fields for this role.",
        );
      break;
    }
    case "profile":
      if (has("currentPassword") && d.currentPassword !== "")
        passwordValue(d.currentPassword, "Current password", { login: true });
      d.name = personName(d.name);
      d.contact = phoneNumber(d.contact);
      if (d.password) {
        d.password = passwordValue(d.password);
        d.currentPassword = passwordValue(
          d.currentPassword,
          "Current password",
          { login: true },
        );
      } else if (has("password"))
        passwordValue(d.password, "Password", { optional: true });
      break;
    case "progress":
      num("progress", "Progress", { max: 100 });
      str("notes", "Site update");
      break;
    case "attendanceUpdate":
      fail(
        "hours",
        "Manual attendance hour overrides are not allowed. Hours come from verified Time In and Time Out.",
      );
      break;
    case "payrollUpdate":
      num("deductions", "Deductions");
      str("reason", "Correction reason");
      break;
    case "paymentUpdate":
      str("remarks", "Payment annotation");
      break;
    case "feedbackReview":
      str("notes", "Review notes");
      break;
    case "notification":
      str("title", "Title", 150);
      str("message", "Message");
      break;
    case "enroll":
    case "attendance":
      d.descriptor = faceDescriptor(
        d.descriptor,
        action === "attendance" ? "Face verification" : "Face enrollment",
      );
      if (action === "attendance") {
        d.projectId = identifier(d.projectId, "Project");
        d.userId = identifier(d.userId, "Employee");
        select("operation", "Attendance action", ["timeIn", "timeOut"]);
        if (d.operation === "timeOut")
          d.attendanceId = identifier(d.attendanceId, "Active attendance");
        else if (has("attendanceId"))
          fail("attendanceId", "Time In must start a new attendance record.");
      }
      if (action === "attendance")
        for (const [k, max] of [
          ["latitude", 90],
          ["longitude", 180],
        ]) {
          if (
            typeof d[k] !== "number" ||
            !Number.isFinite(d[k]) ||
            Math.abs(d[k]) > max
          )
            fail(
              k,
              `${k}: allow location access and supply a coordinate from ${-max} to ${max}.`,
            );
        }
      break;
    case "payroll":
      date("from", "Period start", { max: today() });
      date("to", "Period end", { max: today() });
      if (has("deductions")) num("deductions", "Deductions");
      break;
    case "settings":
      str("name", "Company name", 150);
      str("payrollNote", "Payroll policy");
      break;
  }
  for (const [start, end, label] of [
    ["start", "end", "Completion"],
    ["start", "due", "Task due"],
    ["from", "to", "Period end"],
  ])
    if (d[start] && d[end] && d[end] < d[start])
      fail(end, `${label} date must be on or after the start date.`);
  // Lookup checks supplement, never replace, the server's role/ownership rules.
  if (state) {
    const idTable = {
      bookingOwner: "bookings",
      booking: "bookings",
      bookingDecision: "bookings",
      inspectionAssign: "inspections",
      inspection: "inspections",
      finalize: "quotations",
      quoteDecision: "quotations",
      project: "projects",
      task: "tasks",
      usage: "usage",
      complete: "projects",
      material: "materials",
      user: "users",
      attendanceUpdate: "attendance",
      paymentUpdate: "payments",
      payrollUpdate: "payroll",
      feedbackReview: "feedback",
      payrollPaid: "payroll",
    };
    const refs = {
      clientId: "users",
      foremanId: "users",
      userId: "users",
      assigneeId: "users",
      projectId: "projects",
      inspectionId: "inspections",
      id: idTable[action],
    };
    const find = (table, id, label) => {
      const row = state[table]?.find((x) => x.id === id);
      if (!row)
        fail(
          label,
          `${label}: choose an existing record you are allowed to access.`,
        );
      return row;
    };
    for (const [key, table] of Object.entries(refs))
      if (table && d[key]) find(table, d[key], key);
    for (const id of d.employeeIds || []) find("users", id, "Employee");
    for (const item of d.items || []) {
      const m = find("materials", item.materialId, "Material");
      if (
        ["PCS", "TUBE", "SET"].includes(m.unit) &&
        !Number.isInteger(item.quantity)
      )
        fail("items", `${m.name}: ${m.unit} quantities must be whole numbers.`);
    }
    if (action === "inspection") {
      const inspection = find("inspections", d.id, "Inspection");
      const booking = find("bookings", inspection.bookingId, "Booking");
      choice(
        d.condition,
        "Condition",
        booking.service === "Roof Installation"
          ? [
              "New / No Existing Structure",
              "Good",
              "Fair",
              "Needs Repair",
              "Requires Further Assessment",
            ]
          : [
              "Good",
              "Fair",
              "Damaged",
              "Severely Damaged",
              "Requires Further Assessment",
            ],
      );
    }
    if (action === "enroll" || action === "payroll") {
      const u = find("users", d.userId, "Employee");
      if (u.role !== "Employee")
        fail(
          "userId",
          "Only Employees can be enrolled for attendance or processed for payroll.",
        );
    }
    if (action === "usage") {
      const usage = find("usage", d.id, "Material usage"),
        m = find("materials", usage.materialId, "Material");
      if (
        ["PCS", "TUBE", "SET"].includes(m.unit) &&
        (!Number.isInteger(d.used) || !Number.isInteger(d.delivered))
      )
        fail("used", `${m.unit} material quantities must be whole numbers.`);
    }
  }
  return d;
}
