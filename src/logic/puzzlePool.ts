import { getAllDrills, type DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';

/** Home and Drills draw from this many puzzles. */
export const PUZZLE_POOL_SIZE = 100;

/** A repeated starter puzzle keeps the bank id before this mark. */
const CYCLE_MARK = '~';

const STARTER_IDS = new Set(getAllDrills().map((drill) => drill.id));

export function reviewId(id: string): string {
  const mark = id.lastIndexOf(CYCLE_MARK);
  if (mark <= 0) return id;
  const suffix = id.slice(mark + 1);
  if (!/^\d+$/.test(suffix)) return id;
  return id.slice(0, mark);
}

/**
 * Id stored for a miss. Repeated starter copies use the bank id.
 * A personal position is stored with the miss, because Review cannot load it from the bank.
 */
export function reviewMiss(drill: DrillPosition): { id: string; drill?: DrillPosition } {
  const id = reviewId(drill.id);
  if (STARTER_IDS.has(id)) return { id };
  return { id, drill: drill.id === id ? drill : { ...drill, id } };
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

/**
 * A username scan replaces the same id and fills the rest of the list.
 * Pasted drills the scan did not return stay, even when the scan already fills the list.
 * The same position keeps the scan copy.
 */
export function mergeScannedDrills(
  existing: readonly DrillPosition[],
  scanned: readonly DrillPosition[],
  pastedIds: readonly string[],
  limit = PUZZLE_POOL_SIZE,
): DrillPosition[] {
  const pasted = new Set(pastedIds);
  const seenIds = new Set<string>();
  const seenFens = new Set<string>();
  const fresh: DrillPosition[] = [];
  for (const drill of scanned) {
    const key = fenKey(drill.fen);
    if (seenIds.has(drill.id) || seenFens.has(key)) continue;
    seenIds.add(drill.id);
    seenFens.add(key);
    fresh.push(drill);
  }
  const kept: DrillPosition[] = [];
  for (const drill of existing) {
    if (!pasted.has(drill.id)) continue;
    const key = fenKey(drill.fen);
    if (seenIds.has(drill.id) || seenFens.has(key)) continue;
    seenIds.add(drill.id);
    seenFens.add(key);
    kept.push(drill);
  }
  return keepOwnDrills([...kept, ...fresh], limit);
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
