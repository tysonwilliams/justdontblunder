/** A 3-day streak matches the "On a roll" badge. One saved personal drill counts too. */
export const STREAK_MILESTONE = 3;

export function reachedAccountMilestone(input: {
  dailyStreak: number;
  recordStreak: number;
  savedDrills: number;
}): boolean {
  return (
    input.dailyStreak >= STREAK_MILESTONE ||
    input.recordStreak >= STREAK_MILESTONE ||
    input.savedDrills >= 1
  );
}
