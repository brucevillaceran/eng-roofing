import { safeUser } from "./auth.js";
export function visibleState(s, user) {
  const admin = user.role === "Admin",
    client = user.role === "Client",
    foreman = user.role === "Foreman";
  const projects = s.projects.filter(
    (p) =>
      admin ||
      (client
        ? s.bookings.some((b) => b.id === p.bookingId && b.clientId === user.id)
        : foreman
          ? p.foremanId === user.id
          : p.employeeIds.includes(user.id)),
  );
  const projectIds = new Set(projects.map((p) => p.id));
  const inspections = s.inspections.filter(
    (i) =>
      admin ||
      (foreman
        ? i.foremanId === user.id
        : client &&
          s.bookings.some(
            (b) => b.id === i.bookingId && b.clientId === user.id,
          )),
  );
  const bookingIds = new Set([
    ...projects.map((p) => p.bookingId),
    ...inspections.map((i) => i.bookingId),
  ]);
  const bookings = s.bookings.filter(
    (b) =>
      admin ||
      (client ? b.clientId === user.id : foreman && bookingIds.has(b.id)),
  );
  const quotes = s.quotations.filter(
    (q) =>
      admin ||
      (client
        ? bookings.some((b) => b.id === q.bookingId) &&
          !["Initial Estimate", "Under Review"].includes(q.status)
        : foreman && bookingIds.has(q.bookingId)),
  );
  const personnel = new Set(
    projects.flatMap((p) => [p.foremanId, ...(foreman ? p.employeeIds : [])]),
  );
  const users = s.users
    .filter((u) => admin || u.id === user.id || personnel.has(u.id))
    .map((u) =>
      admin || u.id === user.id
        ? safeUser(u)
        : {
            id: u.id,
            name: u.name,
            role: u.role,
            photo: u.photo,
            initials: u.initials,
            ...(foreman || client ? { contact: u.contact } : {}),
          },
    );
  const materialIds = new Set(
    quotes.flatMap((q) => q.items.map((i) => i.materialId)),
  );
  const empty = Object.fromEntries(Object.keys(s).map((k) => [k, []]));
  return {
    ...empty,
    users,
    bookings: bookings.map((b) =>
      client || admin ? b : (({ token, ...rest }) => rest)(b),
    ),
    inspections: client
      ? inspections.map(
          ({
            id,
            bookingId,
            date,
            status,
            area,
            linear,
            profile,
            condition,
            clientNotes,
          }) => ({
            id,
            bookingId,
            date,
            status,
            area,
            linear,
            profile,
            condition,
            notes: clientNotes || "",
          }),
        )
      : inspections,
    quotations: quotes,
    projects: projects.map((p) =>
      client
        ? { ...p, employeeIds: [] }
        : user.role === "Employee"
          ? { ...p, employeeIds: [user.id] }
          : p,
    ),
    tasks: s.tasks
      .filter(
        (t) =>
          admin ||
          (projectIds.has(t.projectId) &&
            (foreman || client || t.assigneeId === user.id)),
      )
      .map((t) => (client ? { ...t, assigneeId: "", notes: "" } : t)),
    materials:
      admin || foreman
        ? s.materials.filter((m) => admin || m.active || materialIds.has(m.id))
        : [],
    usage:
      admin || foreman
        ? s.usage.filter((u) => admin || projectIds.has(u.projectId))
        : [],
    attendance: s.attendance.filter((a) => admin || a.userId === user.id),
    payroll: s.payroll.filter((p) => admin || p.userId === user.id),
    payments: s.payments.filter(
      (p) => admin || (client && projectIds.has(p.projectId)),
    ),
    feedback: s.feedback
      .filter((f) => admin || (client && projectIds.has(f.projectId)))
      .map((f) =>
        admin
          ? f
          : (({ reviewNotes, reviewedAt, ...submitted }) => submitted)(f),
      ),
    notifications: s.notifications.filter((n) => n.userId === user.id),
    emails: admin ? s.emails : [],
    settings: admin
      ? s.settings
      : s.settings.map(({ id, name, currency, payrollNote }) => ({
          id,
          name,
          currency,
          payrollNote,
        })),
  };
}
