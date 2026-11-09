/** Points for one move that does not hang material or allow mate in one. */
export const XP_PER_SAFE_MOVE = 10;

export function xpAfterAward(current: number, safe: boolean): number {
  if (!safe) return current;
  return current + XP_PER_SAFE_MOVE;
}
