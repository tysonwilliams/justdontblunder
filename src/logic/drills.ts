import type { Square } from 'chess.js';
import { Chess } from 'chess.js';

import beginnerBlunders from '@/src/data/beginner-blunders.json';

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

export function createThemeSession(theme: DrillTheme, count = 5): DrillSession {
  const filtered = ALL.filter((d) => d.theme === theme);
  const seeded = shuffleWithSeed(filtered, Date.now() % 100000);
  return {
    id: `theme-${theme}-${Date.now()}`,
    positions: seeded.slice(0, Math.min(count, seeded.length)),
    startedAt: new Date().toISOString(),
  };
}

/** Accept UCI solutions (e2e4 / e7e8q). */
export function isCorrectDrillMove(drill: DrillPosition, from: Square, to: Square): boolean {
  const uci = `${from}${to}`;
  if (drill.solution.some((sol) => sol.startsWith(uci))) return true;

  const game = new Chess(drill.fen);
  const move = game.move({ from, to, promotion: 'q' });
  if (!move) return false;

  return drill.solution.some((sol) => sol.slice(0, 4) === uci);
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
