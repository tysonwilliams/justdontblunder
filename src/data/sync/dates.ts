const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function addCalendarDays(value: string, days: number): string | null {
  if (!isCalendarDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  const text = utc.toISOString().slice(0, 10);
  return isCalendarDate(text) ? text : null;
}

export function laterDate(left: string | null, right: string | null): string | null {
  const a = left && isCalendarDate(left) ? left : null;
  const b = right && isCalendarDate(right) ? right : null;
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function deviceTimeZone(): string {
  try {
    return cleanTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

export function cleanTimeZone(value: string | null | undefined): string | null {
  if (!value) return null;
  const zone = value.trim();
  if (zone.length < 1 || zone.length > 64) return null;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

export function whole(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), 1_000_000_000);
}
