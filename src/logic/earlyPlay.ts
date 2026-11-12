import type { DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';

type ScanActivity = 'idle' | 'scanning' | 'done' | 'error';

/** Personal blunders that unlock play while the rest of a scan is still running. */
export const EARLY_PLAY_COUNT = 3;

export type PlayGate = {
  found: number;
  /** False once this scan will not add more blunders. */
  incoming: boolean;
  failed: boolean;
};

/**
 * Play opens at three personal blunders.
 * Fewer than that still open once the scan has nothing left to add, including a failure
 * that already saved some. A failure with nothing saved stays on the form.
 */
export function playUnlocked(gate: PlayGate): boolean {
  if (gate.found >= EARLY_PLAY_COUNT) return true;
  if (gate.incoming) return false;
  if (gate.failed) return gate.found > 0;
  return true;
}

/** Short counter suffix. It stays on the existing progress line so the board does not move. */
export function scanNote(phase: ScanActivity, found: number): string | null {
  switch (phase) {
    case 'scanning':
      if (found <= 0) return null;
      return found === 1 ? '1 found' : `${found} found`;
    case 'error':
      if (found <= 0) return null;
      return 'scan stopped';
    case 'idle':
    case 'done':
      return null;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function puzzleCounter(index: number, total: number, note: string | null, spaced: boolean): string {
  const place = spaced ? `${index + 1} / ${total}` : `${index + 1}/${total}`;
  if (!note) return place;
  return `${place} · ${note}`;
}

/**
 * Personal blunders take the front of a short list. The rest of `session` fills up to `limit`.
 * A list that is already as long as the session keeps its own order.
 */
export function leadWithPersonal(
  session: readonly DrillPosition[],
  personal: readonly DrillPosition[],
  limit: number,
): DrillPosition[] {
  if (personal.length === 0 || personal.length >= limit) return session.slice(0, limit);
  const picked: DrillPosition[] = [];
  const seen = new Set<string>();
  const take = (drill: DrillPosition) => {
    if (picked.length >= limit) return;
    const key = fenKey(drill.fen);
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(drill);
  };
  for (const drill of personal) take(drill);
  for (const drill of session) take(drill);
  return picked;
}

/**
 * Keep the puzzle at `index` and everything already reached.
 * New personal blunders take the upcoming seats, ahead of starter fillers.
 * Repeated starter fillers stay in the tail, so a list of 100 does not shrink
 * and the counter and the board do not move.
 */
export function appendIncomingPuzzles(
  current: readonly DrillPosition[],
  personal: readonly DrillPosition[],
  index: number,
): DrillPosition[] {
  if (current.length === 0) return personal.slice();
  const cursor = Math.min(Math.max(index, 0), current.length - 1);
  const prefix = current.slice(0, cursor + 1);
  const placedIds = new Set(prefix.map((drill) => drill.id));
  const placedFens = new Set(prefix.map((drill) => fenKey(drill.fen)));
  const personalFens = new Set(personal.map((drill) => fenKey(drill.fen)));
  const fresh: DrillPosition[] = [];
  for (const drill of personal) {
    const key = fenKey(drill.fen);
    if (placedFens.has(key) || placedIds.has(drill.id)) continue;
    placedFens.add(key);
    placedIds.add(drill.id);
    fresh.push(drill);
  }
  const keptTail: DrillPosition[] = [];
  for (const drill of current.slice(cursor + 1)) {
    if (placedIds.has(drill.id)) continue;
    // A personal position is already in the list. Cycled starter fillers share
    // a position on purpose, so they stay and the session length stays put.
    if (personalFens.has(fenKey(drill.fen))) continue;
    placedIds.add(drill.id);
    keptTail.push(drill);
  }
  return [...prefix, ...fresh, ...keptTail].slice(0, current.length);
}

export function samePositionIds(
  left: readonly { id: string }[],
  right: readonly { id: string }[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i]?.id !== right[i]?.id) return false;
  }
  return true;
}

type Growth = 'hold' | 'adopt' | 'append';

export type GrowthInput = {
  current: readonly DrillPosition[];
  personal: readonly DrillPosition[];
  rebuilt: readonly DrillPosition[];
  index: number;
  /** The player has moved, or a previous update already committed this session. */
  engaged: boolean;
  committed: boolean;
  unlocked: boolean;
  scanning: boolean;
};

function sessionGrowth(input: GrowthInput): Growth {
  if (input.engaged || input.committed) return 'append';
  if (input.scanning && !input.unlocked) return 'hold';
  return 'adopt';
}

/**
 * Hold the visible puzzle until play can start, then adopt that pool once.
 * Later blunders append behind the current puzzle.
 * `positions` is null when the board should stay exactly as it is.
 */
export function nextSessionPositions(input: GrowthInput): {
  positions: readonly DrillPosition[] | null;
  committed: boolean;
} {
  const growth = sessionGrowth(input);
  switch (growth) {
    case 'hold':
      return { positions: null, committed: input.committed };
    case 'adopt':
      return {
        positions: input.rebuilt,
        committed: input.scanning ? input.unlocked : input.personal.length > 0,
      };
    case 'append':
      return {
        positions:
          input.current.length === 0
            ? input.rebuilt
            : appendIncomingPuzzles(input.current, input.personal, input.index),
        committed: true,
      };
    default: {
      const _exhaustive: never = growth;
      return _exhaustive;
    }
  }
}
