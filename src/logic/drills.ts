import type { Square } from 'chess.js';

import beginnerBlunders from '@/src/data/beginner-blunders.json';
import { moveRemovesDanger } from '@/src/logic/danger';

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

const ALL = beginnerBlunders as DrillPosition[];

function hashDay(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function getAllDrills(): DrillPosition[] {
  return ALL;
}

export function createDailySession(date = new Date(), count = 7): DrillSession {
  const key = date.toISOString().slice(0, 10);
  const seeded = shuffleWithSeed(ALL, hashDay(key));
  return {
    id: `daily-${key}`,
    positions: seeded.slice(0, Math.min(count, seeded.length)),
    startedAt: new Date().toISOString(),
  };
}

/** Today's drills, white hanging saves first, so Home opens on the habit. */
export function createHomeSession(date = new Date()): DrillSession {
  const daily = createDailySession(date);
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
export function createAllSession(): DrillSession {
  return {
    id: 'all',
    positions: [...ALL],
    startedAt: new Date().toISOString(),
  };
}

export function createReviewSession(ids: string[]): DrillSession {
  const byId = new Map(ALL.map((drill) => [drill.id, drill]));
  const positions = ids.flatMap((id) => {
    const drill = byId.get(id);
    return drill ? [drill] : [];
  });
  return {
    id: `review-${ids.join('-')}`,
    positions,
    startedAt: new Date().toISOString(),
  };
}

export function createThemeSession(theme: DrillTheme): DrillSession {
  return {
    id: `theme-${theme}`,
    positions: ALL.filter((drill) => drill.theme === theme),
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

