import { getAllDrills, type DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';

/** Home and Drills draw from this many puzzles. */
export const PUZZLE_POOL_SIZE = 100;

/** A repeated starter puzzle keeps the bank id before this mark. */
const CYCLE_MARK = '~';

export function reviewId(id: string): string {
  const mark = id.lastIndexOf(CYCLE_MARK);
  if (mark <= 0) return id;
  const suffix = id.slice(mark + 1);
  if (!/^\d+$/.test(suffix)) return id;
  return id.slice(0, mark);
}

/**
 * Newest personal blunders first, one per position.
 * Starter puzzles fill any gap, and cycle once each unique starter is used.
 * Personal positions are never repeated.
 */
export function buildPuzzlePool(
  own: readonly DrillPosition[],
  starter: readonly DrillPosition[] = getAllDrills(),
): DrillPosition[] {
  const pool: DrillPosition[] = [];
  const ownKeys = new Set<string>();
  for (const drill of own) {
    if (pool.length >= PUZZLE_POOL_SIZE) break;
    const key = fenKey(drill.fen);
    if (ownKeys.has(key)) continue;
    ownKeys.add(key);
    pool.push(drill);
  }
  if (pool.length >= PUZZLE_POOL_SIZE || starter.length === 0) return pool;

  let cycle = 0;
  while (pool.length < PUZZLE_POOL_SIZE && cycle < PUZZLE_POOL_SIZE) {
    let added = 0;
    for (const drill of starter) {
      if (pool.length >= PUZZLE_POOL_SIZE) break;
      if (cycle === 0 && ownKeys.has(fenKey(drill.fen))) continue;
      pool.push(cycle === 0 ? drill : { ...drill, id: `${drill.id}${CYCLE_MARK}${cycle}` });
      added += 1;
    }
    if (added === 0) break;
    cycle += 1;
  }
  return pool;
}

/** Newest first, one per position, at most `limit`. */
export function keepOwnDrills(incoming: readonly DrillPosition[], limit = PUZZLE_POOL_SIZE): DrillPosition[] {
  const out: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const drill of incoming) {
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(drill);
    if (out.length >= limit) break;
  }
  return out;
}

/** Pasted games join the front of the saved list. */
export function mergeOwnDrills(
  existing: readonly DrillPosition[],
  incoming: readonly DrillPosition[],
  limit = PUZZLE_POOL_SIZE,
): DrillPosition[] {
  return keepOwnDrills([...incoming, ...existing], limit);
}

export function foundLine(found: number): string {
  return found === 1 ? 'Found 1 of your blunders.' : `Found ${found} of your blunders.`;
}

export function poolSummary(ownCount: number): string {
  const own = Math.min(Math.max(ownCount, 0), PUZZLE_POOL_SIZE);
  const starter = PUZZLE_POOL_SIZE - own;
  if (own === 0) return 'Starter puzzles fill the list.';
  if (starter === 0) return '100 from your games.';
  const yours = own === 1 ? '1 from your games' : `${own} from your games`;
  const fill = starter === 1 ? '1 starter puzzle fills the rest' : `${starter} starter puzzles fill the rest`;
  return `${yours}. ${fill}.`;
}
