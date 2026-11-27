/**
 * Streak is sudden death on Play. A save is any move that is not a blunder.
 * A blunder is mate in 1 or a net material loss. The best run stays on the device.
 * One run cannot be longer than the puzzle pool.
 */

export const STREAK_SCORE_MAX = 100;

/** Monday 00:00 UTC of the week that contains `instant`. */
export function streakWeekStart(instant: Date): string {
  const day = instant.getUTCDay();
  const fromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()) -
      fromMonday * 24 * 60 * 60 * 1000,
  );
  const year = monday.getUTCFullYear();
  const month = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const date = String(monday.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export function streakScoreInRange(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= STREAK_SCORE_MAX;
}

export function shownBest(current: number, best: number): number {
  return Math.max(0, current, best);
}

/** Counter on the drill lead. Compact fits the phone progress row. */
export function drillStreakExtra(
  streak: boolean,
  current: number,
  best: number,
  compact: boolean,
): string | undefined {
  if (!streak) return undefined;
  const safeCurrent = Math.max(0, current);
  const safeBest = shownBest(safeCurrent, best);
  if (compact) return `${safeCurrent} · best ${safeBest}`;
  return `${safeCurrent} in a row · best ${safeBest}`;
}
