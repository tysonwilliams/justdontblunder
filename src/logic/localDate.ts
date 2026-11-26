/** Calendar date on this device, as `YYYY-MM-DD`. */
export function localDateKey(date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The previous calendar date on this device. */
export function previousLocalDateKey(date = new Date()): string {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

/** True for a real `YYYY-MM-DD` calendar day. */
export function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** Add calendar days to a `YYYY-MM-DD` key. An invalid key is returned unchanged. */
export function addLocalDays(value: string, days: number): string {
  if (!isDateKey(value) || !Number.isFinite(days)) return value;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + Math.trunc(days)));
  return utc.toISOString().slice(0, 10);
}
