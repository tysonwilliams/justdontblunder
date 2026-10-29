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

/** Accept either UCI (e2e4) or SAN if the move matches a solution UCI. */
export function isCorrectDrillMove(drill: DrillPosition, from: Square, to: Square): boolean {
  const uci = `${from}${to}`;
  if (drill.solution.some((sol) => sol.startsWith(uci))) return true;

  // Also accept any legal move that captures the intended idea when solutions list multiple.
  const game = new Chess(drill.fen);
  const move = game.move({ from, to, promotion: 'q' });
  if (!move) return false;

  return drill.solution.some((sol) => {
    if (sol.length < 4) return false;
    return sol.slice(0, 4) === uci;
  });
}

export function themeLabel(theme: DrillTheme): string {
  switch (theme) {
    case 'hanging':
      return 'Hanging pieces';
    case 'fork':
      return 'Forks';
    case 'pin':
      return 'Pins';
    case 'back_rank':
      return 'Back rank';
    case 'missed_mate':
      return 'Mate threats';
    default: {
      const _exhaustive: never = theme;
      return _exhaustive;
    }
  }
}

export function tipsOfTheDay(): string {
  const tips = [
    'Before every move: Checks, Captures, Threats, Hanging?',
    'If a piece has zero defenders, it is probably dinner.',
    'Queen tours early often hang something behind them.',
    'Luft (h3/h6/g3/g6) saves back-rank mates.',
    'Knights fork kings and queens from awkward angles — scan them.',
  ];
  const idx = hashDay(new Date().toISOString().slice(0, 10)) % tips.length;
  return tips[idx]!;
}
