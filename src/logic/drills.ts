import type { Square } from 'chess.js';

import beginnerBlunders from '@/src/data/beginner-blunders.json';
import { moveRemovesDanger } from '@/src/logic/danger';
import { moveOutcome } from '@/src/logic/safety';

export type DrillTheme =
  | 'hanging'
  | 'fork'
  | 'pin'
  | 'back_rank'
  | 'missed_mate';

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
   * or allow mate in 1. A longer forced mate is not, by itself, grounds to omit a move.
   * Mate drills list every move that stops mate in 1 without dropping material.
   */
  acceptable: string[];
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

/** Material-safe, and inside the verified window. Delivering checkmate always counts. */
export function isCorrectDrillMove(drill: DrillPosition, from: Square, to: Square): boolean {
  if (!moveRemovesDanger(drill, from, to)) return false;
  const uci = `${from}${to}`;
  const window = drill.acceptable?.length ? drill.acceptable : drill.solution;
  if (window.some((sol) => sol.startsWith(uci))) return true;
  const outcome = moveOutcome(drill.fen, from, to, drill.sideToMove);
  return outcome !== null && outcome >= 100;
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

export function tipsOfTheDay(): string {
  const tips = [
    'Before every move: scan YOUR pieces for hanging stuff.',
    'If one of your pieces has zero defenders, move it or protect it.',
    'Early queen trips often leave something of yours hanging behind.',
    'Luft (h3/h6/g3/g6) keeps back-rank mates off your king.',
    'When you’re forked, save the higher piece first — usually the queen.',
  ];
  const idx = hashDay(new Date().toISOString().slice(0, 10)) % tips.length;
  return tips[idx]!;
}
