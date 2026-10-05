import {
  workDate,
  elapsedHours,
  roundedHours,
  payrollHours,
} from "../shared/attendance.js";
import {
  validateAction,
  actionRoles,
  numberValue,
  dateValue,
  textValue,
  personName,
  limits,
} from "../shared/validation.js";
import {
  inspectionMaterialAmount,
  serviceTypes,
  standardInspectionItems,
} from "../shared/inspection.js";
import { archiveNonEmployeePayroll } from "./payroll-fields.js";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword, validEmail, roles } from "./auth.js";
export const services = [
  "Roof Installation",
  "Roof Replacement",
  "Roof Repair",
];
export const types = [
  "Residential",
  "Commercial",
  "Industrial",
  "Institutional",
];
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
const fail = (message) => {
  throw new Error(message);
};
const need = (condition, message) => {
  if (!condition) fail(message);
};
const num = (value, label, min = 0) => numberValue(value, label, { min });
const money = (n) => Math.round(n * 100) / 100;
const date = (value, label) => dateValue(value, label);
const text = (value, label) => textValue(value, label);
export const bookingCanBeTracked = (booking) =>
  Boolean(
    booking &&
    ["Approved", "For Inspection", "Completed"].includes(booking.status),
  );
export const balance = (s, p) =>
  money(
    s.quotations.find((q) => q.id === p.quotationId).total -
      s.payments
        .filter((x) => x.projectId === p.id)
        .reduce((a, x) => a + x.amount, 0),
  );
export function apply(s, action, d, actor = {}) {
  const deny = (condition, message) => {
    if (!condition) {
      const error = new Error(message);
      error.status = 403;
      throw error;
    }
  };
  const guestBooking = action === "book" && (!actor || !actor.role);
  const account = s.users.find((u) => u.id === actor.id);
  if (!guestBooking)
    deny(
      account &&
        account.active !== false &&
        account.role === actor.role &&
        roles.includes(actor.role),
      "An active authenticated account is required.",
    );
  const permit = (...roles) => {
    if (guestBooking && action === "book") return;
    deny(
      roles.includes(actor.role),
      "This action is unavailable for your role.",
    );
  };
  if (actionRoles[action]) permit(...actionRoles[action]);
  const get = (table, key) =>
    s[table].find((x) => x.id === key) || fail(`${table} record not found.`);
  const project = (key, allowCompleted = false) => {
    const p = get("projects", key);
    need(!p.locked, "This completed and fully paid project is locked.");
    need(
      allowCompleted || p.status !== "Completed",
      "Completed project work is preserved; only remaining payments can be recorded.",
    );
    if (actor.role === "Foreman")
      deny(
        p.foremanId === actor.id,
        "This project is assigned to another foreman.",
      );
    return p;
  };
  const notify = (role, title, message, userIds = []) => {
    const validUserIds = userIds.filter((id) => typeof id === "string" && id);
    const recipients = s.users.filter(
      (u) =>
        u.active !== false &&
        u.role === role &&
        (validUserIds.length ? validUserIds.includes(u.id) : role === "Admin"),
    );
    for (const u of recipients)
      s.notifications.unshift({
        id: id("NT"),
        userId: u.id,
        role,
        title,
        message,
        createdAt: now(),
        read: false,
      });
  };
  const email = (b, subject, message, path) =>
    s.emails.unshift({
      id: id("MAIL"),
      to: b.email,
      subject,
      message,
      path,
      createdAt: now(),
      status: "Local preview",
    });
  const bookingApprovalEmail = (b) => {
    const link = tracking(b);
    return {
      subject: "Your roofing booking has been approved",
      message: `Your roofing booking has been approved.\n\nBooking details\nReference: ${b.id}\nName: ${b.name}\nContact: ${b.phone}\nService: ${b.service}\nProject type: ${b.type}\nSite address: ${b.address}\nPreferred schedule: ${b.date} at ${b.time}\n\nTrack My Project\n${link}`,
      path: link,
    };
  };
  const event = (p, message) => {
    p.timeline.push({
      text: message,
      at: now(),
      actorId: actor.id,
      progress: p.progress,
    });
    notify("Admin", "Project update", `${p.name}: ${message}`);
    const b = get("bookings", p.bookingId);
    notify("Client", "Project update", `${p.name}: ${message}`, [b.clientId]);
    email(
      b,
      "Roofing project update",
      `${p.name}: ${message}`,
      `/track/${b.token}`,
    );
  };
  const tracking = (b) => `/track/${b.token}`;
  const clientBooking = () => {
    permit("Client");
    const b = s.bookings.find((x) => x.token === d.token);
    need(b, "Tracking link is invalid.");
    deny(b.clientId === actor.id, "This booking belongs to another client.");
    return b;
  };
  const inspectionServiceType = (booking, inspection = {}) =>
    inspection.serviceType || booking.service;
  const updateInspection = (
    inspection,
    data,
    { snapshotCatalogPrice = false } = {},
  ) => {
    for (const key of [
      "date",
      "serviceType",
      "area",
      "linear",
      "sections",
      "profile",
      "complexity",
      "condition",
      "accessories",
      "notes",
      "clientNotes",
      "photos",
    ])
      if (data[key] !== undefined) inspection[key] = data[key];
    if (data.details) {
      const priorDetails = inspection.details || {},
        priorAccessories = new Set(priorDetails.existingAccessoryIds || []);
      inspection.details = { ...priorDetails, ...data.details };
      for (const materialId of inspection.details.existingAccessoryIds || []) {
        const material = get("materials", materialId);
        need(
          material.category === "Accessory" &&
            (material.active || priorAccessories.has(materialId)),
          "Choose existing accessories from active Material Management records.",
        );
      }
      if (inspection.details.existingMaterialId) {
        const material = get(
          "materials",
          inspection.details.existingMaterialId,
        );
        need(
          material.active ||
            priorDetails.existingMaterialId ===
              inspection.details.existingMaterialId,
          "Choose an active material for the existing roof.",
        );
      }
    }
    if (data.items) {
      const prior = new Map(
        (inspection.items || []).map((item) => [item.materialId, item]),
      );
      inspection.items = data.items.map((line) => {
        const material = get("materials", line.materialId),
          old = prior.get(material.id);
        need(
          material.active || old,
          "Disabled materials cannot be added to an inspection.",
        );
        return {
          materialId: material.id,
          name: old?.name || material.name,
          unit: old?.unit || material.unit,
          quantity: line.quantity,
          price: snapshotCatalogPrice
            ? material.price
            : (old?.price ?? material.price),
          category: material.category,
          thickness: material.thickness,
        };
      });
    }
  };
  const inspectionCharges = (booking, details = {}, inspection = {}) => {
    void booking;
    void details;
    void inspection;
    return 0;
  };
  // Check private ownership before reporting field errors for another user's record.
  if (actor.role === "Foreman") {
    if (["inspection", "estimate"].includes(action)) {
      const inspection = get(
        "inspections",
        action === "inspection" ? d.id : d.inspectionId,
      );
      deny(
        inspection.foremanId === actor.id,
        "Inspection is assigned to another foreman.",
      );
    }
    if (["task", "usage", "progress", "complete"].includes(action))
      project(action === "complete" ? d.id : d.projectId);
  }
  if (["quoteDecision", "feedback"].includes(action)) clientBooking();
  d = validateAction(action, d, { state: s, user: actor });
  let result;
  switch (action) {
    case "book": {
      permit("Admin", "Client");
      const guest = !actor || !actor.role;
      const owner =
        actor && actor.role === "Client"
          ? account
          : guest
            ? null
            : get("users", d.clientId);
      if (!guest) {
        need(
          owner.role === "Client" && owner.active !== false,
          "Choose an active client account.",
        );
      }
      const name = guest
          ? personName(d.name, "Client name")
          : personName(owner.name, "Client name"),
        emailAddress = guest ? validEmail(d.email) : validEmail(owner.email);
      need(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress),
        "Enter a valid email address.",
      );
      need(
        services.includes(d.service) && types.includes(d.type),
        "Choose a roofing service and project type.",
      );
      const b = {
        id: id("BK"),
        clientId: guest ? undefined : owner.id,
        name,
        email: emailAddress,
        phone: text(d.phone, "Contact number"),
        address: text(d.address, "Address"),
        date: date(d.date, "Preferred date"),
        time: text(d.time, "Preferred time"),
        service: d.service,
        type: d.type,
        description: text(d.description, "Roofing concern"),
        photos: Array.isArray(d.photos) ? d.photos.slice(0, 5) : [],
        status: "Pending",
        submitted_at: now(),
        token: randomUUID(),
      };
      need(
        b.date >= now().slice(0, 10),
        "Preferred date cannot be in the past.",
      );
      s.bookings.push(b);
      email(
        b,
        "Your roofing booking request was received",
        `Thank you, ${b.name}. Your request ${b.id} is pending review. We will contact you after it has been reviewed.`,
      );
      notify(
        "Admin",
        "New roofing booking",
        `${b.name} requested ${b.service.toLowerCase()}.`,
      );
      result = { id: b.id, submitted_at: b.submitted_at };
      break;
    }
    case "bookingOwner": {
      permit("Admin");
      const b = get("bookings", d.id),
        u = get("users", d.clientId);
      need(!b.clientId, "This booking is already linked to a client account.");
      need(
        u.role === "Client" && u.active !== false,
        "Choose an active client account.",
      );
      b.clientId = u.id;
      notify(
        "Client",
        "Booking linked to your account",
        `${b.id}: ${b.service}`,
        [u.id],
      );
      break;
    }
    case "booking": {
      permit("Admin");
      const b = get("bookings", d.id);
      need(
        !s.quotations.some((q) => q.bookingId === b.id),
        "A quotation exists; booking details are preserved.",
      );
      Object.assign(b, {
        name: text(d.name || b.name, "Name"),
        phone: d.phone || b.phone,
        address: text(d.address || b.address, "Address"),
        description: d.description ?? b.description,
        date: date(d.date || b.date, "Preferred date"),
        time: d.time || b.time,
      });
      break;
    }
    case "bookingDecision": {
      permit("Admin");
      const b = get("bookings", d.id);
      need(b.status === "Pending", "Only pending bookings can be decided.");
      need(
        !s.quotations.some((q) => q.bookingId === b.id),
        "A quotation exists; booking details are preserved.",
      );
      b.status = d.status;
      if (d.status === "Approved") {
        if (!s.inspections.some((i) => i.bookingId === b.id))
          s.inspections.push({
            id: id("IN"),
            bookingId: b.id,
            serviceType: "",
            date: b.date,
            status: "Awaiting Assignment",
            area: 0,
            linear: 0,
            profile: "Not Determined",
            complexity: "Simple",
            sections: 1,
            condition: "Requires Further Assessment",
            accessories: [],
            notes: "",
            photos: [],
            items: standardInspectionItems(s.materials),
          });
        const approval = bookingApprovalEmail(b);
        email(b, approval.subject, approval.message, approval.path);
      } else {
        email(
          b,
          "Your roofing booking request was rejected",
          `Your roofing booking request was rejected.\n\nBooking details\nReference: ${b.id}\nName: ${b.name}\nContact: ${b.phone}\nService: ${b.service}\nProject type: ${b.type}\nSite address: ${b.address}\nPreferred schedule: ${b.date} at ${b.time}`,
        );
      }
      if (b.clientId)
        notify("Client", "Booking update", `${b.id}: ${b.status}`, [
          b.clientId,
        ]);
      break;
    }
    case "inspectionAssign": {
      permit("Admin");
      const i = get("inspections", d.id),
        b = get("bookings", i.bookingId);
      need(
        b.status === "Approved",
        "Only approved bookings can be assigned for inspection.",
      );
      need(
        !["Completed"].includes(i.status) &&
          !s.quotations.some((q) => q.inspectionId === i.id),
        "This inspection can no longer be reassigned.",
      );
      const inspector = get("users", d.foremanId);
      need(
        inspector.role === "Foreman" && inspector.active !== false,
        "Assign an active inspector.",
      );
      Object.assign(i, {
        foremanId: inspector.id,
        date: date(d.date, "Inspection date"),
        status: "Scheduled",
      });
      notify("Foreman", "Inspection assigned", `${b.name} · ${i.date}`, [
        inspector.id,
      ]);
      break;
    }
    case "inspectionDraft":
    case "inspectionSubmit": {
      permit("Foreman", "Admin");
      const i = get("inspections", d.id),
        b = get("bookings", i.bookingId);
      need(b.status === "Approved", "Only approved bookings can be inspected.");
      if (actor.role === "Foreman")
        deny(
          i.foremanId === actor.id,
          "Inspection is assigned to another foreman.",
        );
      need(
        !["Completed", "Submitted for Review"].includes(i.status) &&
          !s.quotations.some((q) => q.inspectionId === i.id),
        "This inspection has already been submitted for review.",
      );
      updateInspection(i, d, {
        snapshotCatalogPrice: action === "inspectionSubmit",
      });
      if (action === "inspectionDraft") {
        i.status = "In Progress";
        break;
      }
      need(
        i.foremanId,
        "Assign an inspector before submitting the inspection.",
      );
      const serviceType = i.serviceType;
      need(
        serviceTypes.includes(serviceType),
        "Choose the inspection service type.",
      );
      need(i.date, "Enter the inspection date.");
      need(i.area > 0, "Roof area must be greater than zero.");
      need(i.linear > 0, "Linear measurement must be greater than zero.");
      need(
        Number.isInteger(i.sections) && i.sections > 0,
        "Number of roof sections must be a positive whole number.",
      );
      need(i.complexity, "Select the roof complexity.");
      const details = i.details || {};
      if (
        serviceType !== "Roof Installation" &&
        (!i.profile || i.profile === "Not Determined")
      )
        i.profile = details.existingProfile || "Other";
      if (serviceType === "Roof Installation") {
        need(
          i.profile && i.profile !== "Not Determined",
          "Select the roof type.",
        );
        if (i.profile === "Other")
          need(details.customRoofType, "Enter the custom roof type.");
        need(
          [
            "New/No existing Structure",
            "Good",
            "Fair",
            "Needs Repair",
          ].includes(details.supportingCondition),
          "Enter the supporting structure condition.",
        );
      }
      if (serviceType === "Roof Replacement") {
        need(
          ["Good", "Fair", "Poor"].includes(i.condition),
          "Select the existing roof condition.",
        );
        need(
          details.existingMaterialId,
          "Select the existing roofing material.",
        );
        need(
          details.existingProfile &&
            details.existingProfile !== "Not Determined",
          "Select the existing roof profile.",
        );
        if (details.existingProfile === "Other")
          need(
            details.existingCustomRoofType,
            "Enter the custom existing roof type.",
          );
        need(details.existingArea > 0, "Enter the existing roof area.");
        need(details.structuralCondition, "Enter the structural condition.");
        need(
          details.existingMaterialCondition,
          "Select the existing material condition.",
        );
        need(details.structuralWork, "Select the additional structure work.");
      }
      if (serviceType === "Roof Repair") {
        need(
          ["Fair", "Poor", "Severe"].includes(i.condition),
          "Select the roof condition.",
        );
        need(
          details.existingMaterialId,
          "Select the existing roofing material.",
        );
        need(
          details.existingProfile &&
            details.existingProfile !== "Not Determined",
          "Select the existing roof profile.",
        );
        if (details.existingProfile === "Other")
          need(
            details.existingCustomRoofType,
            "Enter the custom existing roof type.",
          );
        need(details.existingArea > 0, "Enter the roof area.");
        need(details.damagedArea > 0, "Enter the damaged area.");
        need(details.damageType, "Select the damage type.");
        if (details.damageType === "Other")
          need(details.otherDamageType, "Enter the custom damage type.");
        need(details.damageSeverity, "Select the damage severity.");
        need(details.damagedSheets > 0, "Enter the number of damaged sheets.");
      }
      need(
        i.items?.length && i.items.every((item) => Number(item.quantity) > 0),
        "Select materials and enter a positive quantity for each.",
      );
      const total = money(
        i.items.reduce((sum, item) => sum + inspectionMaterialAmount(item), 0),
      );
      need(
        total <= limits.amount,
        "Initial estimate exceeds the allowed amount.",
      );
      i.status = "Submitted for Review";
      s.quotations.push({
        id: id("QT"),
        bookingId: b.id,
        inspectionId: i.id,
        items: i.items.map(({ materialId, name, unit, quantity, price }) => ({
          materialId,
          name,
          unit,
          quantity,
          price,
        })),
        charges: 0,
        total,
        downpayment: 0,
        status: "Initial Estimate",
        notes: i.notes || "",
        createdAt: now(),
      });
      notify(
        "Admin",
        "Inspection submitted for review",
        `${b.name} · ${b.service} · Initial estimate ${total}`,
      );
      break;
    }
    case "inspection": {
      permit("Admin");
      const i = get("inspections", d.id);
      const b = get("bookings", i.bookingId);
      need(b.status === "Approved", "Only approved bookings can be inspected.");
      need(
        i.foremanId,
        "Assign an inspector before completing the inspection.",
      );
      if (actor.role === "Foreman")
        deny(
          i.foremanId === actor.id,
          "Inspection is assigned to another foreman.",
        );
      need(
        !s.quotations.some((q) => q.inspectionId === i.id),
        "Inspection is preserved after an estimate is created.",
      );
      const sections = num(d.sections, "Roof sections", 1);
      need(Number.isInteger(sections), "Roof sections must be a whole number.");
      Object.assign(i, {
        serviceType: d.serviceType || i.serviceType || b.service,
        area: num(d.area, "Roof area", 0.01),
        linear: num(d.linear, "Linear measurement"),
        sections,
        profile: text(d.profile, "Roof profile"),
        complexity: d.complexity,
        condition: text(d.condition, "Condition"),
        accessories: d.accessories || [],
        notes: d.notes || "",
        clientNotes: d.clientNotes || "",
        photos: d.photos || [],
        date: date(d.date, "Inspection date"),
        status: "Completed",
      });
      notify(
        "Client",
        "Inspection completed",
        `${i.id}: ${i.clientNotes || "Inspection results are available."}`,
        [get("bookings", i.bookingId).clientId],
      );
      break;
    }
    case "estimate": {
      permit("Foreman", "Admin");
      const i = get("inspections", d.inspectionId);
      need(
        bookingCanBeTracked(get("bookings", i.bookingId)),
        "Only approved bookings can proceed to quotation.",
      );
      need(i.status === "Completed", "Complete the site inspection first.");
      if (actor.role === "Foreman")
        deny(
          i.foremanId === actor.id,
          "Inspection is assigned to another foreman.",
        );
      need(
        !s.quotations.some((q) => q.inspectionId === i.id),
        "An estimate already exists for this inspection.",
      );
      need(d.items?.length, "Select at least one material.");
      need(
        new Set(d.items.map((x) => x.materialId)).size === d.items.length,
        "A material may appear only once.",
      );
      const items = d.items.map((x) => {
        const m = get("materials", x.materialId);
        need(m.active, "Disabled materials cannot be selected.");
        return {
          materialId: m.id,
          name: m.name,
          unit: m.unit,
          quantity: num(x.quantity, "Quantity", 0.01),
          price: m.price,
        };
      });
      if (actor.role === "Foreman" && Number(d.charges || 0) > 0)
        deny(
          false,
          "Foremen can only submit the initial material estimate; labor and additional charges are admin-only.",
        );
      const materialTotal = money(
        items.reduce((a, x) => a + x.quantity * x.price, 0),
      );
      need(
        materialTotal <= limits.amount,
        "Quotation total cannot exceed ₱1,000,000,000.",
      );
      const q = {
        id: id("QT"),
        bookingId: i.bookingId,
        inspectionId: i.id,
        items,
        charges: 0,
        total: materialTotal,
        downpayment: 0,
        status: "Initial Estimate",
        notes: d.notes || "",
        createdAt: now(),
      };
      s.quotations.push(q);
      notify(
        "Admin",
        "Initial estimate submitted",
        `${q.id} is ready for review.`,
      );
      break;
    }
    case "finalize": {
      permit("Admin");
      const q = get("quotations", d.id);
      need(
        ["Initial Estimate", "Under Review"].includes(q.status),
        "Only an initial estimate can be finalized.",
      );
      if (d.items) {
        need(d.items.length, "Select at least one material.");
        need(
          new Set(d.items.map((x) => x.materialId)).size === d.items.length,
          "A material may appear only once.",
        );
        q.items = d.items.map((x) => {
          const old = q.items.find((o) => o.materialId === x.materialId),
            m = get("materials", x.materialId);
          need(old || m.active, "Disabled materials cannot be selected.");
          return {
            materialId: m.id,
            name: old?.name || m.name,
            unit: old?.unit || m.unit,
            quantity: num(x.quantity, "Quantity", 0.01),
            price: old?.price ?? m.price,
          };
        });
      }
      const materialTotal = money(
        q.items.reduce((a, x) => a + x.quantity * x.price, 0),
      );
      const namedChargeFields = [
        ["hardwareAttachments", "Hardware & Attachments"],
        ["installationFee", "Installation Fee"],
        ["deliveryCharges", "Delivery Charges"],
        ["insulation", "Insulation"],
        ["otherCharges", "Other Charges"],
      ];
      const namedCharges = money(
        namedChargeFields.reduce(
          (sum, [key, label]) =>
            sum +
            (Object.hasOwn(d, key) || Object.hasOwn(q, key)
              ? num(d[key] ?? q[key] ?? 0, label)
              : 0),
          0,
        ),
      );
      const legacyCharges = Object.hasOwn(d, "charges")
        ? num(d.charges, "Additional charges")
        : Object.hasOwn(q, "charges")
          ? num(q.charges, "Additional charges")
          : 0;
      const additionalCharges = money(
        namedChargeFields.some(
          ([key]) => Object.hasOwn(d, key) || Object.hasOwn(q, key),
        )
          ? namedCharges
          : legacyCharges,
      );
      const discount = num(d.discount ?? q.discount ?? 0, "Discount");
      const subtotal = money(materialTotal + additionalCharges);
      need(discount <= subtotal, "Discount cannot exceed the subtotal.");
      q.charges = additionalCharges;
      q.hardwareAttachments = namedChargeFields.some(([key]) =>
        Object.hasOwn(d, key),
      )
        ? num(
            d.hardwareAttachments ?? q.hardwareAttachments ?? 0,
            "Hardware & Attachments",
          )
        : (q.hardwareAttachments ?? 0);
      q.installationFee = namedChargeFields.some(([key]) =>
        Object.hasOwn(d, key),
      )
        ? num(d.installationFee ?? q.installationFee ?? 0, "Installation Fee")
        : (q.installationFee ?? 0);
      q.deliveryCharges = namedChargeFields.some(([key]) =>
        Object.hasOwn(d, key),
      )
        ? num(d.deliveryCharges ?? q.deliveryCharges ?? 0, "Delivery Charges")
        : (q.deliveryCharges ?? 0);
      q.insulation = namedChargeFields.some(([key]) => Object.hasOwn(d, key))
        ? num(d.insulation ?? q.insulation ?? 0, "Insulation")
        : (q.insulation ?? 0);
      q.otherCharges = namedChargeFields.some(([key]) => Object.hasOwn(d, key))
        ? num(d.otherCharges ?? q.otherCharges ?? 0, "Other Charges")
        : (q.otherCharges ?? 0);
      q.discount = discount;
      q.total = money(subtotal - discount);
      need(
        q.total <= limits.amount,
        "Quotation total cannot exceed ₱1,000,000,000.",
      );
      q.downpayment = money(q.total * 0.5);
      q.notes = d.notes ?? q.notes;
      q.status = "Awaiting Client";
      const b = get("bookings", q.bookingId);
      email(
        b,
        "Your final roofing quotation is ready",
        `Review quotation ${q.id} and approve or reject it using your tracking link.\n\nFinal quotation total: ₱${q.total.toFixed(2)}\nRequired downpayment (50%): ₱${q.downpayment.toFixed(2)}\nRemaining balance after downpayment: ₱${(q.total - q.downpayment).toFixed(2)}`,
        tracking(b),
      );
      notify(
        "Client",
        "Quotation available",
        `${q.id} is ready for your review.`,
        [b.clientId],
      );
      break;
    }
    case "quoteDecision": {
      const b = clientBooking(),
        q = get("quotations", d.id);
      need(
        q.bookingId === b.id && q.status === "Awaiting Client",
        "Quotation is not awaiting your decision.",
      );
      need(["Approved", "Rejected"].includes(d.status), "Invalid decision.");
      q.status = d.status;
      notify(
        "Admin",
        `Quotation ${d.status.toLowerCase()}`,
        `${b.name} · ${q.id}`,
      );
      if (d.status === "Approved") {
        const p = {
          id: id("PRJ"),
          bookingId: b.id,
          quotationId: q.id,
          name:
            d.name ||
            `${b.name.split(" ").slice(-1)} ${b.type === "Residential" ? "Residence" : "Roofing Project"}`,
          client: b.name,
          service: b.service,
          type: b.type,
          address: b.address,
          status: "Pending",
          progress: 0,
          start: "",
          end: "",
          foremanId: "",
          employeeIds: [],
          requirements: false,
          locked: false,
          createdAt: now(),
          timeline: [
            {
              text: "Client approved quotation · job order created",
              at: now(),
            },
          ],
        };
        s.projects.push(p);
        q.items.forEach((x) =>
          s.usage.push({
            id: id("USE"),
            projectId: p.id,
            materialId: x.materialId,
            used: 0,
            delivered: 0,
          }),
        );
        b.status = "Completed";
        email(
          b,
          "Your roofing project is approved",
          `Job order ${p.id} has been created. Our team will confirm your schedule.`,
          tracking(b),
        );
        result = p;
      }
      break;
    }
    case "project": {
      permit("Admin");
      const p = project(d.id);
      need(
        [
          "Pending",
          "Approved",
          "Scheduled",
          "Ongoing",
          "On Hold",
          "Cancelled",
        ].includes(d.status),
        "Use the completion action to complete a project.",
      );
      need(
        !d.foremanId ||
          (get("users", d.foremanId).role === "Foreman" &&
            get("users", d.foremanId).active !== false),
        "Invalid foreman.",
      );
      const employeeIds = d.employeeIds || [];
      need(
        Array.isArray(employeeIds) &&
          new Set(employeeIds).size === employeeIds.length &&
          employeeIds.every(
            (e) =>
              get("users", e).role === "Employee" &&
              get("users", e).active !== false,
          ),
        "Invalid employee assignment.",
      );
      if (["Scheduled", "Ongoing"].includes(d.status)) {
        need(
          d.foremanId && employeeIds.length,
          "Assign a foreman and at least one employee.",
        );
        date(d.start, "Start date");
        date(d.end, "Estimated completion");
        need(
          d.end >= d.start,
          "Completion estimate must be after the start date.",
        );
      }
      if (d.status === "Ongoing")
        need(
          s.quotations.find((q) => q.id === p.quotationId).total -
            balance(s, p) >=
            s.quotations.find((q) => q.id === p.quotationId).downpayment,
          "Record the agreed downpayment before starting work.",
        );
      need(
        !s.attendance.some(
          (a) =>
            a.projectId === p.id &&
            !a.checkOut &&
            (!employeeIds.includes(a.userId) || !d.foremanId),
        ),
        "Complete active attendance before removing its Employee or the project Foreman.",
      );
      Object.assign(p, {
        name: text(d.name || p.name, "Project name"),
        foremanId: d.foremanId || "",
        employeeIds,
        start: d.start || "",
        end: d.end || "",
        status: d.status,
      });
      event(p, `Project ${p.status.toLowerCase()} · personnel updated`);
      notify(
        "Employee",
        "Project assignment",
        `${p.name} · ${p.start || "Schedule pending"}`,
        p.employeeIds,
      );
      notify("Foreman", "Project assignment", p.name, [p.foremanId]);
      break;
    }
    case "task": {
      permit("Foreman", "Admin");
      const p = project(d.projectId);
      const assigneeId = text(d.assigneeId, "Assigned personnel");
      need(
        [p.foremanId, ...p.employeeIds].includes(assigneeId) &&
          get("users", assigneeId).active !== false,
        "Assign the task to project personnel.",
      );
      const t = d.id ? get("tasks", d.id) : { id: id("TSK"), projectId: p.id };
      need(t.projectId === p.id, "Task does not belong to project.");
      const progress = num(d.progress, "Progress");
      need(progress <= 100, "Progress cannot exceed 100%.");
      const start = date(d.start, "Task start"),
        due = date(d.due, "Task due date");
      need(due >= start, "Task due date must follow start.");
      need(
        (!p.start || start >= p.start) && (!p.end || due <= p.end),
        "Task dates must be within the project schedule.",
      );
      Object.assign(t, {
        name: text(d.name, "Task name"),
        assigneeId,
        start,
        due,
        progress,
        notes: d.notes || "",
        required: d.required !== false,
      });
      if (!d.id) s.tasks.push(t);
      const tasks = s.tasks.filter((x) => x.projectId === p.id);
      p.progress = Math.round(
        tasks.reduce((a, x) => a + x.progress, 0) / tasks.length,
      );
      event(p, `${t.name} · ${progress}% complete`);
      break;
    }
    case "usage": {
      permit("Foreman", "Admin");
      const p = project(d.projectId),
        u = get("usage", d.id);
      need(u.projectId === p.id, "Material does not belong to project.");
      const delivered = num(d.delivered, "Delivered quantity"),
        used = num(d.used, "Used quantity");
      need(used <= delivered, "Usage cannot exceed delivered material.");
      Object.assign(u, { used, delivered });
      event(p, "Material delivery and usage updated");
      break;
    }
    case "payment": {
      permit("Admin");
      const p = project(d.projectId, true),
        amount = money(num(d.amount, "Payment amount", 0.01));
      need(
        amount <= balance(s, p),
        "Payment cannot exceed the remaining balance.",
      );
      s.payments.push({
        id: id("PAY"),
        projectId: p.id,
        amount,
        method: text(d.method, "Payment method"),
        date: date(d.date, "Payment date"),
        reference: text(d.reference, "Reference number"),
        remarks: d.remarks || "",
        createdAt: now(),
      });
      const b = get("bookings", p.bookingId);
      email(
        b,
        "Payment received",
        `We received ₱${amount.toLocaleString()} for ${p.name}. Remaining balance: ₱${balance(s, p).toLocaleString()}.`,
        tracking(b),
      );
      notify("Admin", "Payment received", p.name);
      notify(
        "Client",
        "Payment received",
        `${p.name}: ₱${amount}. Balance: ₱${balance(s, p)}`,
        [b.clientId],
      );
      if (p.status === "Completed" && balance(s, p) === 0) p.locked = true;
      break;
    }
    case "complete": {
      permit("Admin", "Foreman");
      const p = project(d.id);
      need(p.status !== "Completed", "Project is already completed.");
      need(
        !s.attendance.some((a) => a.projectId === p.id && !a.checkOut),
        "Complete all active Time Outs before completing the project.",
      );
      need(
        p.foremanId && p.employeeIds.length,
        "Assign a foreman and employees before completion.",
      );
      const tasks = s.tasks.filter((t) => t.projectId === p.id && t.required);
      need(
        tasks.length && tasks.every((t) => t.progress === 100),
        "Complete all required project tasks first.",
      );
      need(
        d.requirements === true,
        "Confirm the project requirements and final inspection are satisfied.",
      );
      p.requirements = true;
      p.status = "Completed";
      p.progress = 100;
      p.locked = balance(s, p) === 0;
      event(p, "Project completed · final inspection passed");
      const b = get("bookings", p.bookingId);
      email(
        b,
        "Your roof is complete — share your feedback",
        `Thank you for choosing ENG Roofing. Please rate installation, service, timeliness, and professionalism.`,
        `${tracking(b)}?feedback=1`,
      );
      break;
    }
    case "feedback": {
      const b = clientBooking(),
        p = get("projects", d.projectId);
      need(
        p.bookingId === b.id && p.status === "Completed",
        "Feedback is available after project completion.",
      );
      need(
        !s.feedback.some((f) => f.projectId === p.id),
        "Feedback has already been submitted.",
      );
      const f = {
        id: id("FB"),
        projectId: p.id,
        name: b.name,
        comments: d.comments || "",
        createdAt: now(),
      };
      for (const key of [
        "installation",
        "service",
        "timeliness",
        "professionalism",
      ]) {
        f[key] = num(d[key], key, 1);
        need(
          Number.isInteger(f[key]) && f[key] <= 5,
          "Ratings must be from 1 to 5.",
        );
      }
      s.feedback.push(f);
      notify("Admin", "Feedback submitted", `${b.name} rated ${p.name}.`);
      break;
    }
    case "material": {
      permit("Admin");
      const m = d.id ? get("materials", d.id) : { id: id("MAT"), history: [] };
      m.history.unshift({
        at: now(),
        price: m.price ?? null,
        unit: m.unit ?? null,
        name: m.name ?? null,
        newPrice: num(d.price, "Price"),
        note: d.id ? "Material updated" : "Material created",
      });
      Object.assign(m, {
        name: text(d.name, "Material name"),
        unit: text(d.unit, "Unit"),
        price: num(d.price, "Price"),
        category: text(d.category, "Category"),
        profile: d.profile || "Other",
        thickness: d.thickness || "",
        active: d.active !== false,
      });
      if (!d.id) s.materials.push(m);
      break;
    }
    case "user": {
      permit("Admin");
      need(roles.includes(d.role), "Invalid role.");
      const u = d.id
        ? get("users", d.id)
        : { id: id("USR"), sessionVersion: 0 };
      const emailAddress = validEmail(d.email);
      need(
        !s.users.some(
          (other) =>
            other.id !== u.id && other.email.toLowerCase() === emailAddress,
        ),
        "Email already belongs to another account.",
      );
      const active = d.active !== false && d.active !== "Inactive";
      if (u.role === "Admin" && (!active || d.role !== "Admin"))
        need(
          s.users.some(
            (other) =>
              other.id !== u.id &&
              other.role === "Admin" &&
              other.active !== false &&
              other.passwordHash,
          ),
          "At least one active administrator must remain.",
        );
      if (d.id && u.role !== d.role) {
        need(
          !s.projects.some(
            (p) => p.foremanId === u.id || p.employeeIds.includes(u.id),
          ) &&
            !s.inspections.some((i) => i.foremanId === u.id) &&
            !s.bookings.some((b) => b.clientId === u.id) &&
            !s.attendance.some((a) => a.userId === u.id) &&
            !s.payroll.some((p) => p.userId === u.id),
          "This account has linked role records. Preserve its role and create a separate account if needed.",
        );
      }
      if (!d.id || d.password) u.passwordHash = hashPassword(d.password);
      else
        need(
          u.passwordHash,
          "Set an initial password for this existing account.",
        );
      u.sessionVersion = (u.sessionVersion || 0) + 1;
      Object.assign(u, {
        name: text(d.name, "Name"),
        role: d.role,
        email: emailAddress,
        contact: text(d.contact, "Contact"),
        photo: d.photo || u.photo || "",
        ...(d.role === "Employee"
          ? { rate: d.rate, descriptor: d.descriptor || u.descriptor }
          : {}),
        active,
        initials: d.name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join(""),
      });
      archiveNonEmployeePayroll(s, u);
      if (!d.id) s.users.push(u);
      break;
    }
    case "profile": {
      const u = get("users", actor.id);
      u.name = text(d.name, "Name");
      u.contact = text(d.contact, "Contact");
      if (d.password) {
        const { currentPassword } = d;
        // Password changes require the current credential even with an active session.
        need(
          verifyPassword(currentPassword, u.passwordHash),
          "Current password is incorrect.",
        );
        u.passwordHash = hashPassword(d.password);
        u.sessionVersion = (u.sessionVersion || 0) + 1;
      }
      break;
    }
    case "progress": {
      permit("Admin", "Foreman");
      const p = project(d.projectId),
        progress = num(d.progress, "Progress");
      need(progress <= 100, "Progress cannot exceed 100%.");
      p.progress = progress;
      event(p, text(d.notes, "Site update"));
      break;
    }
    case "attendanceUpdate": {
      fail(
        "Manual attendance hour overrides are not allowed. Hours are calculated from verified Time In and Time Out.",
      );
      break;
    }
    case "paymentUpdate": {
      permit("Admin");
      const p = get("payments", d.id);
      p.annotations ||= [];
      const remarks = text(d.remarks, "Payment annotation");
      p.annotations.push({
        previousRemarks: p.remarks || "",
        remarks,
        actorId: actor.id,
        at: now(),
      });
      p.remarks = remarks;
      p.updatedAt = now();
      break;
    }
    case "payrollUpdate": {
      permit("Admin");
      const p = get("payroll", d.id);
      need(p.status !== "Paid", "Released payroll is preserved.");
      const deductions = money(num(d.deductions, "Deductions"));
      need(deductions <= p.gross, "Deductions cannot exceed gross pay.");
      p.adjustments ||= [];
      const reason = text(d.reason, "Correction reason");
      p.adjustments.push({
        previousDeductions: p.deductions,
        deductions,
        reason,
        actorId: actor.id,
        at: now(),
      });
      p.deductions = deductions;
      p.net = money(p.gross - deductions);
      p.correctionReason = reason;
      break;
    }
    case "feedbackReview": {
      permit("Admin");
      const f = get("feedback", d.id);
      f.reviewNotes = text(d.notes, "Review notes");
      f.reviewedAt = now();
      break;
    }
    case "notification": {
      permit("Admin");
      const recipient = get("users", d.userId);
      need(
        recipient.active !== false,
        "Choose an active notification recipient.",
      );
      notify(
        recipient.role,
        text(d.title, "Title"),
        text(d.message, "Message"),
        [recipient.id],
      );
      break;
    }
    case "enroll": {
      permit("Admin");
      const u = get("users", d.userId);
      need(u.role === "Employee", "Only Employees can enroll for attendance.");
      need(
        Array.isArray(d.descriptor) &&
          d.descriptor.length === 128 &&
          d.descriptor.every(Number.isFinite),
        "A valid facial descriptor is required.",
      );
      u.descriptor = d.descriptor;
      break;
    }
    case "attendance": {
      permit("Foreman");
      const p = get("projects", d.projectId);
      deny(
        p.foremanId === actor.id,
        "This project is assigned to another foreman.",
      );
      const u = get("users", d.userId);
      deny(
        u.role === "Employee" && p.employeeIds.includes(u.id),
        "Choose an Employee assigned to this project.",
      );
      need(u.active !== false, "This Employee account is inactive.");
      need(
        Array.isArray(u.descriptor) &&
          u.descriptor.length === 128 &&
          u.descriptor.every(
            (x) =>
              typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 2,
          ),
        "Ask Admin to enroll this Employee's face before attendance.",
      );
      const distance = Math.sqrt(
        u.descriptor.reduce(
          (sum, value, i) => sum + (value - d.descriptor[i]) ** 2,
          0,
        ),
      );
      need(distance < 0.5, "Face verification failed. Please try again.");
      const timestamp = now(),
        today = workDate(timestamp);
      const open = s.attendance.filter((a) => a.userId === u.id && !a.checkOut);
      if (d.operation === "timeOut") {
        const a = get("attendance", d.attendanceId);
        deny(
          a.userId === u.id && a.projectId === p.id,
          "Attendance does not belong to this Employee and project.",
        );
        need(
          a.checkIn && !a.checkOut,
          "Time Out requires an active Time In; completed attendance cannot be recorded again.",
        );
        need(a.verified === true, "Only a verified Time In can be completed.");
        need(
          !s.payroll.some((pay) => pay.attendanceIds.includes(a.id)),
          "Attendance used by payroll is preserved.",
        );
        const hours = roundedHours(elapsedHours({ ...a, checkOut: timestamp }));
        Object.assign(a, {
          checkOut: timestamp,
          checkOutLatitude: d.latitude,
          checkOutLongitude: d.longitude,
          hours,
          checkOutForemanId: actor.id,
          updatedAt: timestamp,
        });
        result = a;
      } else {
        need(
          !open.length,
          "This Employee is already Timed In. Complete Time Out for the active project first.",
        );
        need(
          !s.attendance.some(
            (a) =>
              a.userId === u.id && a.projectId === p.id && a.date === today,
          ),
          "Attendance is already complete for this Employee, project and work date.",
        );
        need(
          !p.locked &&
            p.status === "Ongoing" &&
            p.start <= today &&
            p.end >= today,
          "Time In requires an ongoing assigned project scheduled for today.",
        );
        // A new clock record must not change a period already processed for payroll.
        need(
          !s.payroll.some(
            (pay) =>
              pay.userId === u.id && pay.from <= today && pay.to >= today,
          ),
          "Payroll already includes this work date. Attendance cannot be added to a processed period.",
        );
        const a = {
          id: id("ATT"),
          userId: u.id,
          projectId: p.id,
          foremanId: actor.id,
          date: today,
          checkIn: timestamp,
          checkOut: null,
          hours: 0,
          latitude: d.latitude,
          longitude: d.longitude,
          verified: true,
          source: "Foreman portal · face descriptor + geotag",
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        s.attendance.push(a);
        result = a;
      }
      notify(
        "Employee",
        d.operation === "timeIn" ? "Time In recorded" : "Time Out recorded",
        `${u.name} · ${p.name}`,
        [u.id],
      );
      break;
    }
    case "payroll": {
      permit("Admin");
      const u = get("users", d.userId);
      need(u.role === "Employee", "Choose an Employee.");
      numberValue(u.rate, "Daily rate", { min: 0.01, max: limits.rate });
      const from = date(d.from, "Period start"),
        to = date(d.to, "Period end");
      need(to >= from, "Invalid payroll period.");
      need(
        !s.payroll.some(
          (p) => p.userId === u.id && p.from <= to && p.to >= from,
        ),
        "A payroll already overlaps this period.",
      );
      need(
        !s.attendance.some(
          (a) =>
            a.userId === u.id && a.date >= from && a.date <= to && !a.checkOut,
        ),
        "Complete all active Time Outs in this payroll period first.",
      );
      const attendance = s.attendance.filter(
        (a) =>
          a.userId === u.id &&
          a.date >= from &&
          a.date <= to &&
          a.checkOut &&
          a.verified,
      );
      need(
        attendance.length,
        "No completed, verified attendance for this period.",
      );
      const { hours, workedHours } = payrollHours(attendance),
        gross = money((hours / 8) * u.rate),
        deductions = money(num(d.deductions || 0, "Deductions"));
      need(deductions <= gross, "Deductions cannot exceed gross pay.");
      s.payroll.push({
        id: id("PR"),
        userId: u.id,
        from,
        to,
        attendanceIds: attendance.map((a) => a.id),
        workedHours,
        days: money(hours / 8),
        hours,
        rate: u.rate,
        gross,
        deductions,
        net: money(gross - deductions),
        status: "Processed",
        createdAt: now(),
      });
      notify(u.role, "Payroll available", `${u.name} · ${from} to ${to}`, [
        u.id,
      ]);
      break;
    }
    case "payrollPaid": {
      permit("Admin");
      const p = get("payroll", d.id);
      need(p.status !== "Paid", "Payroll is already released.");
      p.status = "Paid";
      p.releasedAt = now();
      const u = get("users", p.userId);
      notify(u.role, "Payroll released", `${p.from} to ${p.to}: ₱${p.net}`, [
        u.id,
      ]);
      break;
    }
    case "read": {
      permit("Admin", "Foreman", "Employee", "Client");
      s.notifications
        .filter((n) => n.userId === actor.id)
        .forEach((n) => (n.read = true));
      break;
    }
    case "settings": {
      permit("Admin");
      s.settings[0].name = text(d.name, "Company name");
      s.settings[0].payrollNote = text(d.payrollNote, "Payroll policy");
      break;
    }
    default:
      fail("Unknown action.");
  }
  return result || { ok: true };
}
