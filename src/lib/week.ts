// Week math. Weeks always run Monday -> Sunday.
// Everything here stays in local time: `new Date().toISOString()` shifts the
// date backwards in negative-UTC timezones and can turn a Monday into a Sunday.

/** Days after a week's Sunday that it stays adjustable. */
export const ADJUSTMENT_GRACE_DAYS = 7;

export type WeekKey = string; // YYYY-MM-DD, always a Monday

export function toDateKey(date: Date): WeekKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `date`. */
export function getWeekStart(date: Date = new Date()): WeekKey {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toDateKey(d);
}

/** Snaps any date-ish value to the Monday of its week. */
export function normalizeWeekStart(value: any): WeekKey {
  if (!value) return getWeekStart();
  if (typeof value === 'string') return getWeekStart(parseDateKey(value));
  if (value instanceof Date) return getWeekStart(value);
  if (typeof value.toDate === 'function') return getWeekStart(value.toDate());
  return getWeekStart();
}

export function addWeeks(week: WeekKey, count: number): WeekKey {
  const d = parseDateKey(week);
  d.setDate(d.getDate() + count * 7);
  return toDateKey(d);
}

/** Sunday that closes the week. */
export function getWeekEnd(week: WeekKey): Date {
  const d = parseDateKey(week);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Last moment a week can still be adjusted: 7 days after its Sunday. */
export function getAdjustmentDeadline(week: WeekKey): Date {
  const deadline = getWeekEnd(week);
  deadline.setDate(deadline.getDate() + ADJUSTMENT_GRACE_DAYS);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

export function isWeekLocked(week: WeekKey, now: Date = new Date()): boolean {
  return now > getAdjustmentDeadline(week);
}

export function isCurrentWeek(week: WeekKey, now: Date = new Date()): boolean {
  return week === getWeekStart(now);
}

/** Days left to adjust, or 0 once locked. */
export function daysUntilLocked(week: WeekKey, now: Date = new Date()): number {
  const ms = getAdjustmentDeadline(week).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** "6 Jul – 12 Jul" */
export function formatWeekRange(week: WeekKey): string {
  const start = parseDateKey(week);
  const end = getWeekEnd(week);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export function formatWeekRangeLong(week: WeekKey): string {
  const start = parseDateKey(week);
  const end = getWeekEnd(week);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
  const endStr = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

/** "This week" / "Next week" / "3 weeks ago" — for orienting the navigator. */
export function describeWeekOffset(week: WeekKey, now: Date = new Date()): string {
  const current = parseDateKey(getWeekStart(now));
  const target = parseDateKey(week);
  const diffWeeks = Math.round((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24 * 7));

  if (diffWeeks === 0) return 'This week';
  if (diffWeeks === 1) return 'Next week';
  if (diffWeeks === -1) return 'Last week';
  if (diffWeeks > 1) return `In ${diffWeeks} weeks`;
  return `${Math.abs(diffWeeks)} weeks ago`;
}
