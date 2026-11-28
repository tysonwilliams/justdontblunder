import { addLocalDays, isDateKey, localDateKey } from '@/src/logic/localDate';

/**
 * Leitner gaps after a successful review.
 * A miss returns to the short box: due the same day, and the next save waits 1 day.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 16, 35] as const;

/** Packed into `review_entries.interval_days` so a 1-day card is not the old two-save mirror. */
export const INTERVAL_PACK = 100;

/** The database allows interval_days up to 3650, which fits this many successes at the last gap. */
export const MAX_SAVES = 36;

export type ReviewSchedule = {
  /** Successful reviews since the last miss. 0 is the short box. */
  saves: number;
  /** 0 means due now. Otherwise one of REVIEW_INTERVALS. */
  intervalDays: number;
  /** Next calendar day this card should be served, inclusive. */
  dueOn: string;
};

export function dueNow(today: string): ReviewSchedule {
  return { saves: 0, intervalDays: 0, dueOn: today };
}

/** A miss is due again today. The next successful review earns the 1-day gap. */
export function lapseSchedule(today: string): ReviewSchedule {
  return dueNow(today);
}

export function intervalForSaves(saves: number): number {
  if (saves <= 0) return 0;
  const index = Math.min(Math.floor(saves), REVIEW_INTERVALS.length) - 1;
  return REVIEW_INTERVALS[index] ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

export function savesForInterval(intervalDays: number): number {
  if (intervalDays <= 0) return 0;
  const index = REVIEW_INTERVALS.indexOf(intervalDays as (typeof REVIEW_INTERVALS)[number]);
  return index < 0 ? 0 : index + 1;
}

export function advanceSchedule(schedule: ReviewSchedule, today: string): ReviewSchedule {
  const base = Math.max(schedule.saves, savesForInterval(schedule.intervalDays));
  const saves = Math.min(base + 1, MAX_SAVES);
  const intervalDays = intervalForSaves(saves);
  return { saves, intervalDays, dueOn: addLocalDays(today, intervalDays) };
}

/** Earlier due date, then the shorter gap. A tie keeps `left`. */
export function moreConservative(left: ReviewSchedule, right: ReviewSchedule): ReviewSchedule {
  if (left.dueOn !== right.dueOn) return left.dueOn < right.dueOn ? left : right;
  if (left.intervalDays !== right.intervalDays) return left.intervalDays < right.intervalDays ? left : right;
  if (left.saves !== right.saves) return left.saves < right.saves ? left : right;
  return left;
}

export function isDue(entry: { dueOn?: string; intervalDays?: number }, today: string): boolean {
  if (!entry.dueOn || entry.intervalDays === 0) return true;
  return entry.dueOn <= today;
}

export function dueTodayCount(
  entries: readonly { dueOn?: string; intervalDays?: number }[],
  today = localDateKey(),
): number {
  return entries.reduce((count, entry) => count + (isDue(entry, today) ? 1 : 0), 0);
}

export function dueTodayLabel(count: number): string {
  if (count <= 0) return 'Nothing due today';
  if (count === 1) return '1 due today';
  return `${count} due today`;
}

export function formatReviewGap(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Natural phrasing for when an upcoming review returns ("tomorrow", "in 3 days"). */
export function formatDueWhen(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function nextReviewGapDays(
  entry: { saves?: number; intervalDays?: number } | undefined,
): number {
  const base = Math.max(entry?.saves ?? 0, savesForInterval(entry?.intervalDays ?? 0));
  return intervalForSaves(Math.min(base + 1, MAX_SAVES));
}

export function filterDueEntries<T extends { dueOn?: string; intervalDays?: number }>(
  entries: readonly T[],
  today = localDateKey(),
): T[] {
  return entries.filter((entry) => isDue(entry, today));
}

/** Due cards first (oldest first), then later cards (soonest first). */
export function orderForReview<T extends { dueOn?: string }>(entries: readonly T[], today: string): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftDue = isDue(left.entry, today);
      const rightDue = isDue(right.entry, today);
      if (leftDue !== rightDue) return leftDue ? -1 : 1;
      const leftDate = left.entry.dueOn ?? '';
      const rightDate = right.entry.dueOn ?? '';
      if (leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
      return left.index - right.index;
    })
    .map((item) => item.entry);
}

/**
 * Database `interval_days`.
 * 0 is the short box. A scheduled card is `saves * 100 + interval`, so a 1-day
 * card is 101 rather than 1. 1 is the old two-save mirror and is read as due now.
 */
export function packIntervalDays(schedule: ReviewSchedule): number {
  const saves = Math.min(MAX_SAVES, Math.max(0, Math.floor(schedule.saves)));
  if (saves <= 0 || schedule.intervalDays <= 0) return 0;
  return Math.min(saves * INTERVAL_PACK + intervalForSaves(saves), 3650);
}

/** Read a `review_entries.interval_days` value. Values under 100 are the old pile. */
export function scheduleFromStored(storedInterval: number, dueOn: string | null, today: string): ReviewSchedule {
  const stored = Number.isFinite(storedInterval) ? Math.max(0, Math.floor(storedInterval)) : 0;
  const date = dueOn && isDateKey(dueOn) ? dueOn : null;
  if (stored >= INTERVAL_PACK) {
    const saves = Math.min(MAX_SAVES, Math.floor(stored / INTERVAL_PACK));
    const intervalDays = intervalForSaves(saves);
    return { saves, intervalDays, dueOn: date ?? addLocalDays(today, intervalDays) };
  }
  if (stored === 0 && date && date <= today) return { saves: 0, intervalDays: 0, dueOn: date };
  return dueNow(today);
}

/** Local JSON. Missing dates are the old pile and become due today. */
export function scheduleFromSaved(
  value: { saves?: unknown; dueOn?: unknown; intervalDays?: unknown },
  today: string,
): ReviewSchedule {
  const rawInterval =
    typeof value.intervalDays === 'number' && Number.isFinite(value.intervalDays)
      ? Math.floor(value.intervalDays)
      : null;
  const dueOn = typeof value.dueOn === 'string' && isDateKey(value.dueOn) ? value.dueOn : null;
  if (rawInterval != null && rawInterval >= INTERVAL_PACK) return scheduleFromStored(rawInterval, dueOn, today);
  if (dueOn && rawInterval != null && (rawInterval === 0 || isLadder(rawInterval))) {
    return alignSaved(rawInterval, value.saves, dueOn, today);
  }
  return dueNow(today);
}

function alignSaved(intervalDays: number, savesValue: unknown, dueOn: string, today: string): ReviewSchedule {
  if (intervalDays <= 0) return { saves: 0, intervalDays: 0, dueOn: dueOn <= today ? dueOn : today };
  const fromInterval = savesForInterval(intervalDays);
  const claimed =
    typeof savesValue === 'number' && Number.isFinite(savesValue) && savesValue > 0
      ? Math.min(MAX_SAVES, Math.floor(savesValue))
      : fromInterval;
  const saves =
    intervalForSaves(claimed) === intervalDays ? claimed : Math.min(claimed, fromInterval);
  return { saves, intervalDays: intervalForSaves(saves), dueOn };
}

function isLadder(value: number): boolean {
  return (REVIEW_INTERVALS as readonly number[]).includes(value);
}
