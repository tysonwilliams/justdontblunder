import { getAllDrills, type DrillPosition, type DrillTheme } from '@/src/logic/drills';
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

/**
 * Full pool for a filter: every personal blunder matching the theme first,
 * followed by every unique starter puzzle (unless `ownOnly` is true).
 * Never slices off unique starters beyond PUZZLE_POOL_SIZE.
 */
export function buildPoolForTheme(
  own: readonly DrillPosition[],
  theme: 'all' | DrillTheme,
  starter: readonly DrillPosition[] = getAllDrills(),
  options: { ownOnly?: boolean } = {},
): DrillPosition[] {
  const pool: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const drill of own) {
    if (theme !== 'all' && drill.theme !== theme) continue;
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(drill);
  }
  if (options.ownOnly) return pool;
  for (const drill of starter) {
    if (theme !== 'all' && drill.theme !== theme) continue;
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(drill);
  }
  return pool;
}

/** Deterministic Fisher-Yates shuffle for Streak runs and fresh sets. */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = (seed >>> 0) || 1;
  const nextRand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/** Rotate a list forward by `offset` items so returning players start on fresh puzzles. */
export function rotateList<T>(items: readonly T[], offset: number): T[] {
  if (items.length <= 1) return [...items];
  const shift = ((Math.floor(offset) % items.length) + items.length) % items.length;
  if (shift === 0) return [...items];
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/**
 * Order a drill session so personal blunders ALWAYS take precedence over built-in
 * starter puzzles — even in Streak shuffles or after hitting Restart.
 * Built-in starters only lead when the player has no personal blunders for the filter.
 */
export function orderPoolWithOwnFirst(
  own: readonly DrillPosition[],
  theme: 'all' | DrillTheme,
  options: {
    starter?: readonly DrillPosition[];
    ownOnly?: boolean;
    sudden?: boolean;
    seed?: number;
    restartCount?: number;
    drillsCompleted?: number;
  } = {},
): DrillPosition[] {
  const starter = options.starter ?? getAllDrills();
  const seen = new Set<string>();
  const personal: DrillPosition[] = [];
  for (const drill of own) {
    if (theme !== 'all' && drill.theme !== theme) continue;
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    personal.push(drill);
  }
  const builtIn: DrillPosition[] = [];
  if (!options.ownOnly) {
    for (const drill of starter) {
      if (theme !== 'all' && drill.theme !== theme) continue;
      const key = fenKey(drill.fen);
      if (seen.has(key)) continue;
      seen.add(key);
      builtIn.push(drill);
    }
  }

  if (options.sudden) {
    const baseSeed = options.seed ?? 1;
    const shuffledOwn = shuffleWithSeed(personal, baseSeed);
    const shuffledBuiltIn = shuffleWithSeed(builtIn, (baseSeed ^ 0x9e3779b9) >>> 0);
    return [...shuffledOwn, ...shuffledBuiltIn];
  }

  const restartCount = options.restartCount ?? 0;
  if (restartCount > 0) {
    const rotatedOwn = rotateList(personal, restartCount);
    const rotatedBuiltIn = rotateList(builtIn, restartCount * 11);
    return [...rotatedOwn, ...rotatedBuiltIn];
  }

  // Keep drillsCompleted === 0 in canonical order so first-visit Play starts on hang-q-01.
  const drillsCompleted = options.drillsCompleted ?? 0;
  if (!options.ownOnly && personal.length === 0 && drillsCompleted > 0) {
    return rotateList(builtIn, drillsCompleted);
  }

  return [...personal, ...builtIn];
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
