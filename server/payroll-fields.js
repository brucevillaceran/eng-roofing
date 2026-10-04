import { randomUUID } from "node:crypto";
// Preserve prior non-employee payroll attributes without leaving them usable.
// Historical attendance and payroll rows are never changed by this cleanup.
export function archiveNonEmployeePayroll(state, user) {
  if (
    user.role === "Employee" ||
    (!Object.hasOwn(user, "rate") && !Object.hasOwn(user, "descriptor"))
  )
    return;
  if (user.rate != null || user.descriptor != null) {
    state.userPayrollArchive ||= [];
    state.userPayrollArchive.push({
      id: `ARCH-${randomUUID()}`,
      userId: user.id,
      role: user.role,
      rate: user.rate ?? null,
      descriptor: user.descriptor ?? null,
      archivedAt: new Date().toISOString(),
    });
  }
  delete user.rate;
  delete user.descriptor;
}
