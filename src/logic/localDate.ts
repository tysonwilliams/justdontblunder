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
