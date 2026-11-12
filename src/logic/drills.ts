import type { Square } from 'chess.js';

import beginnerBlunders from '@/src/data/beginner-blunders.json';
import { moveRemovesDanger } from '@/src/logic/danger';
import { localDateKey } from '@/src/logic/localDate';

export type DrillTheme =
  | 'hanging'
  | 'fork'
  | 'pin'
  | 'back_rank'
  | 'missed_mate';

/** A move that looks safe until the opponent's short refutation. */
export type DrillTrap = {
  move: string;
  /** UCI moves starting with the opponent's reply. */
  line: string[];
  explanation: string;
};

export type DrillPosition = {
  id: string;
  fen: string;
  sideToMove: 'w' | 'b';
  theme: DrillTheme;
  atRiskSquare: Square;
  prompt: string;
  solution: string[];
  /**
   * Moves within about 1.5 pawns of the engine best that do not drop material
   * or allow mate in 1. Used for hints and "Show the idea", not to fail a safe move.
   * A longer forced mate is not, by itself, grounds to omit a move.
   */
  acceptable: string[];
  /**
   * Safe on the one-move material rule, but a short tactic still wins material.
   * Precomputed offline. The judge reads this list and does not search at runtime.
   */
  traps: DrillTrap[];
  note: string;
  expectedDropCp: number;
};

export type DrillSession = {
  id: string;
  positions: DrillPosition[];
  startedAt: string;
};

export type ThemeAccuracy = Partial<Record<DrillTheme, { attempts: number; correct: number }>>;

/** A theme can pull the daily pack only after this many tries. */
export const WEAK_THEME_MIN_ATTEMPTS = 4;

const THEME_ORDER: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

/** The theme with the worst accuracy, once it has a handful of tries. */
export function weakestTheme(stats: ThemeAccuracy | undefined): DrillTheme | null {
  if (!stats) return null;
  let picked: { theme: DrillTheme; accuracy: number; attempts: number } | null = null;
  for (const theme of THEME_ORDER) {
    const tally = stats[theme];
    if (!tally || tally.attempts < WEAK_THEME_MIN_ATTEMPTS) continue;
    const accuracy = tally.correct / tally.attempts;
    if (
      !picked ||
      accuracy < picked.accuracy ||
      (accuracy === picked.accuracy && tally.attempts > picked.attempts)
    ) {
      picked = { theme, accuracy, attempts: tally.attempts };
    }
  }
  return picked?.theme ?? null;
}

const ALL = beginnerBlunders as DrillPosition[];

function hashDay(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function fenIdentity(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function getAllDrills(): DrillPosition[] {
  return ALL;
}

export function createDailySession(
  date = new Date(),
  count = 7,
  stats?: ThemeAccuracy,
  source?: readonly DrillPosition[],
): DrillSession {
  const key = localDateKey(date);
  const seeded = shuffleWithSeed(source ?? ALL, hashDay(key));
  return {
    id: `daily-${key}`,
    positions: leanTowardWeak(seeded, count, stats),
    startedAt: new Date().toISOString(),
  };
}

/**
 * Keep every theme in the pack, and give the spare seats to the weakest one.
 * With no recorded tries, the pack stays the plain daily shuffle.
 */
function leanTowardWeak(seeded: readonly DrillPosition[], count: number, stats?: ThemeAccuracy): DrillPosition[] {
  const weak = weakestTheme(stats);
  if (!weak) return fillSeats(seeded, count, seeded);
  const byTheme = new Map<DrillTheme, DrillPosition[]>();
  for (const theme of THEME_ORDER) byTheme.set(theme, []);
  for (const drill of seeded) byTheme.get(drill.theme)?.push(drill);
  const firstPass: DrillPosition[] = [];
  for (const theme of THEME_ORDER) {
    if (theme === weak) continue;
    const drill = byTheme.get(theme)?.[0];
    if (drill) firstPass.push(drill);
  }
  return fillSeats(firstPass, count, [...(byTheme.get(weak) ?? []), ...seeded]);
}

/** Unique positions first. Repeated starter puzzles fill a short pack only after that. */
function fillSeats(
  preferred: readonly DrillPosition[],
  count: number,
  rest: readonly DrillPosition[],
): DrillPosition[] {
  const picked: DrillPosition[] = [];
  const usedId = new Set<string>();
  const usedFen = new Set<string>();
  const take = (drill: DrillPosition, allowRepeatFen: boolean) => {
    if (picked.length >= count || usedId.has(drill.id)) return;
    const key = fenIdentity(drill.fen);
    if (!allowRepeatFen && usedFen.has(key)) return;
    picked.push(drill);
    usedId.add(drill.id);
    usedFen.add(key);
  };
  for (const drill of preferred) take(drill, false);
  for (const drill of rest) take(drill, false);
  for (const drill of rest) take(drill, true);
  return picked;
}

/** Today's drills, white hanging saves first, so Home opens on the habit. */
export function createHomeSession(
  date = new Date(),
  stats?: ThemeAccuracy,
  source?: readonly DrillPosition[],
): DrillSession {
  const daily = createDailySession(date, 7, stats, source);
  const whiteHanging = daily.positions.filter(
    (drill) => drill.theme === 'hanging' && drill.sideToMove === 'w',
  );
  const blackHanging = daily.positions.filter(
    (drill) => drill.theme === 'hanging' && drill.sideToMove === 'b',
  );
  const rest = daily.positions.filter((drill) => drill.theme !== 'hanging');
  return {
    id: `home-${daily.id}`,
    positions: [...whiteHanging, ...blackHanging, ...rest],
    startedAt: daily.startedAt,
  };
}

export const HOME_HANGING_PROMPT = 'Something of yours is hanging. Make everything safe.';

/** One plain sentence for the Home board. Hanging puzzles use the habit line. */
export function homePlayPrompt(drill: DrillPosition): string {
  switch (drill.theme) {
    case 'hanging':
      return HOME_HANGING_PROMPT;
    case 'fork':
    case 'pin':
    case 'back_rank':
    case 'missed_mate':
      return drill.prompt;
    default: {
      const _exhaustive: never = drill.theme;
      return _exhaustive;
    }
  }
}

/** Every drill, in a fixed order, so All is the whole bank and numbers stay put. */
export function createAllSession(source?: readonly DrillPosition[]): DrillSession {
  return {
    id: 'all',
    positions: source ? [...source] : [...ALL],
    startedAt: new Date().toISOString(),
  };
}

export function createReviewSession(
  ids: readonly string[],
  theme?: DrillTheme,
  personal: readonly DrillPosition[] = [],
): DrillSession {
  const byId = new Map(ALL.map((drill) => [drill.id, drill]));
  for (const drill of personal) byId.set(drill.id, drill);
  const positions = ids.flatMap((id) => {
    const drill = byId.get(id);
    if (!drill || (theme && drill.theme !== theme)) return [];
    return [drill];
  });
  return {
    id: theme ? `review-${theme}` : `review-${ids.join('-')}`,
    positions,
    startedAt: new Date().toISOString(),
  };
}

export function createThemeSession(theme: DrillTheme, source?: readonly DrillPosition[]): DrillSession {
  const list = source ?? ALL;
  return {
    id: `theme-${theme}`,
    positions: list.filter((drill) => drill.theme === theme),
    startedAt: new Date().toISOString(),
  };
}

/** Engine window used for hints and "Show the idea". It does not decide pass or fail. */
export function teachingMoves(drill: DrillPosition): string[] {
  return drill.acceptable?.length ? drill.acceptable : drill.solution;
}

export function drillTrap(drill: DrillPosition, from: Square, to: Square): DrillTrap | null {
  const uci = `${from}${to}`;
  return drill.traps.find((trap) => trap.move === uci) ?? null;
}

/**
 * A move passes when it avoids a blunder: no mate in 1, and no material loss.
 * Equal trades pass. Checkmate always passes. Mate in 2 or more does not fail a move.
 * A precomputed two-move trap still fails. The engine window never turns a pass into a fail.
 */
export function isCorrectDrillMove(drill: DrillPosition, from: Square, to: Square): boolean {
  if (!moveRemovesDanger(drill, from, to)) return false;
  return drillTrap(drill, from, to) === null;
}

export const HABIT_PROMPT = 'Before you move: is anything of yours hanging?';

/** Plain drill prompt: whose move it is, with no tactic hint. */
export function turnPrompt(side: 'w' | 'b'): string {
  switch (side) {
    case 'w':
      return 'White to move';
    case 'b':
      return 'Black to move';
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

export function themeInstruction(theme: DrillTheme): string {
  switch (theme) {
    case 'hanging':
      return 'This piece can be taken for free. Move it, defend it, or take the attacker.';
    case 'fork':
      return 'One enemy piece attacks two of yours. Save the one you would lose.';
    case 'pin':
      return 'That piece is pinned to your king. Do not step it off the line.';
    case 'back_rank':
      return 'Back-rank mate is one move away. Block it, or give the king a square.';
    case 'missed_mate':
      return 'They can mate you next move. Stop that. A longer mate is not the task.';
    default: {
      const _exhaustive: never = theme;
      return _exhaustive;
    }
  }
}

export function themeLabel(theme: DrillTheme): string {
  switch (theme) {
    case 'hanging':
      return 'Save hanging pieces';
    case 'fork':
      return 'Break the fork';
    case 'pin':
      return 'Unpin / escape';
    case 'back_rank':
      return 'Guard the back rank';
    case 'missed_mate':
      return 'Stop mate on you';
    default: {
      const _exhaustive: never = theme;
      return _exhaustive;
    }
  }
}

