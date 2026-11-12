import type { StateCreator } from 'zustand';

import type { DrillTheme } from '@/src/logic/drills';
import { withLessonComplete } from '@/src/logic/lessons';
import { localDateKey, previousLocalDateKey } from '@/src/logic/localDate';
import { applyDrillResult } from '@/src/store/drillStats';
import type { ProgressState, ThemeTally } from '@/src/store/progressTypes';
import { xpAfterAward } from '@/src/store/xp';

export type TrainingData = {
  dailyStreak: number;
  lastDrillDate: string | null;
  drillsCompleted: number;
  drillsCorrect: number;
  blundersAvoided: number;
  blundersMade: number;
  practiceMoves: number;
  themeStats: Partial<Record<DrillTheme, ThemeTally>>;
  recordStreak: number;
  bestPuzzleStreak: number;
  xp: number;
  completedLessons: string[];
};

type TrainingSlice = TrainingData &
  Pick<
    ProgressState,
    'markDrillResult' | 'awardXp' | 'completeLesson' | 'recordPuzzleRun' | 'markPracticeMove'
  >;

export function initialTraining(): TrainingData {
  return {
    dailyStreak: 0,
    lastDrillDate: null,
    drillsCompleted: 0,
    drillsCorrect: 0,
    blundersAvoided: 0,
    blundersMade: 0,
    practiceMoves: 0,
    themeStats: {},
    recordStreak: 0,
    bestPuzzleStreak: 0,
    xp: 0,
    completedLessons: [],
  };
}

function bumpStreak(lastDrillDate: string | null, dailyStreak: number, now = new Date()): {
  dailyStreak: number;
  lastDrillDate: string;
} {
  const today = localDateKey(now);
  if (lastDrillDate === today) return { dailyStreak, lastDrillDate: today };
  if (lastDrillDate === previousLocalDateKey(now)) {
    return { dailyStreak: dailyStreak + 1, lastDrillDate: today };
  }
  return { dailyStreak: 1, lastDrillDate: today };
}

export const createTrainingSlice: StateCreator<ProgressState, [], [], TrainingSlice> = (set) => ({
  ...initialTraining(),
  markDrillResult: (correct, theme) =>
    set((state) => {
      const streak = bumpStreak(state.lastDrillDate, state.dailyStreak);
      const prev = state.themeStats[theme] ?? { attempts: 0, correct: 0 };
      return {
        ...streak,
        ...applyDrillResult(state, correct),
        themeStats: {
          ...state.themeStats,
          [theme]: {
            attempts: prev.attempts + 1,
            correct: prev.correct + (correct ? 1 : 0),
          },
        },
        recordStreak: Math.max(state.recordStreak, streak.dailyStreak),
        xp: xpAfterAward(state.xp, correct),
      };
    }),
  awardXp: (safe) => set((state) => ({ xp: xpAfterAward(state.xp, safe) })),
  completeLesson: (id) =>
    set((state) => ({ completedLessons: withLessonComplete(state.completedLessons, id) })),
  recordPuzzleRun: (length) =>
    set((state) => ({
      bestPuzzleStreak: Math.max(state.bestPuzzleStreak, length),
    })),
  markPracticeMove: (avoidedBlunder, madeBlunder) =>
    set((state) => ({
      practiceMoves: state.practiceMoves + 1,
      blundersAvoided: state.blundersAvoided + (avoidedBlunder ? 1 : 0),
      blundersMade: state.blundersMade + (madeBlunder ? 1 : 0),
    })),
});
