// Date helpers for the follow-up system. Dates are stored as local "YYYY-MM-DD"
// strings so day-level comparisons and calendar matching stay trivial.

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayStr = (): string => toDateStr(new Date());

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysStr(base: string, n: number): string {
  const d = parseDateStr(base);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function formatDateLong(s: string): string {
  return parseDateStr(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// "Today" / "Tomorrow" / "Yesterday" when close, otherwise a short date.
export function relativeDay(s: string): string {
  const t = todayStr();
  if (s === t) return "Today";
  if (s === addDaysStr(t, 1)) return "Tomorrow";
  if (s === addDaysStr(t, -1)) return "Yesterday";
  return formatDateLong(s);
}

export const isOverdue = (s: string): boolean => s < todayStr();
