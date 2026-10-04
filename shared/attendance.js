// Keep the existing UTC work-date convention and eight-hour paid-day rule.
export const workDate = (value = new Date()) =>
  new Date(value).toISOString().slice(0, 10);
export const roundedHours = (value) => Math.round(value * 100) / 100;
export function elapsedHours(record) {
  const start = Date.parse(record.checkIn),
    end = Date.parse(record.checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error(
      "Attendance must have a valid Time Out after Time In before payroll can be processed.",
    );
  return (end - start) / 3600000;
}
export const attendanceStatus = (record) =>
  !record ? "Not Timed In" : record.checkOut ? "Completed" : "Working";
export function payrollHours(records) {
  const perDay = new Map();
  let actual = 0;
  const ordered = [...records].sort(
    (a, b) => Date.parse(a.checkIn) - Date.parse(b.checkIn),
  );
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i],
      hours = elapsedHours(a);
    if (i && Date.parse(a.checkIn) < Date.parse(ordered[i - 1].checkOut))
      throw new Error(
        "Overlapping attendance records must be reviewed before payroll is processed.",
      );
    actual += hours;
    perDay.set(a.date, (perDay.get(a.date) || 0) + hours);
  }
  return {
    workedHours: roundedHours(actual),
    hours: roundedHours(
      [...perDay.values()].reduce((sum, hours) => sum + Math.min(8, hours), 0),
    ),
  };
}
