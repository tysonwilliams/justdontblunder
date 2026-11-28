import type { StateCreator } from 'zustand';

import type { DrillTheme } from '@/src/logic/drills';
import { withLessonComplete } from '@/src/logic/lessons';
import { localDateKey, previousLocalDateKey } from '@/src/logic/localDate';
import { applyDrillResult } from '@/src/store/drillStats';
import type { DailyTally, ProgressState, ThemeTally } from '@/src/store/progressTypes';
import { xpAfterAward } from '@/src/store/xp';

const HISTORY_DAYS_LIMIT = 14;

export type TrainingData = {
  dailyStreak: number;
  lastDrillDate: string | null;
  dailyCompletedDate: string | null;
  dailyOutcomes: boolean[];
  dailyHistory: Record<string, DailyTally>;
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
    'markDrillResult' | 'markDailyComplete' | 'awardXp' | 'completeLesson' | 'recordPuzzleRun' | 'markPracticeMove'
  >;

export function initialTraining(): TrainingData {
  return {
    dailyStreak: 0,
    lastDrillDate: null,
    dailyCompletedDate: null,
    dailyOutcomes: [],
    dailyHistory: {},
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

const XP_PER_LESSON = 25;

/** Displayed daily streak. Returns 0 when the last trained day is older than yesterday. */
export function activeDailyStreak(
  dailyStreak: number,
  lastDrillDate: string | null,
  now = new Date(),
): number {
  if (dailyStreak <= 0 || !lastDrillDate) return 0;
  const today = localDateKey(now);
  const yesterday = previousLocalDateKey(now);
  return lastDrillDate === today || lastDrillDate === yesterday ? dailyStreak : 0;
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

function appendDailyHistory(
  history: Record<string, DailyTally>,
  today: string,
  correct: boolean,
): Record<string, DailyTally> {
  const prev = history[today] ?? { done: 0, correct: 0 };
  const merged: Record<string, DailyTally> = {
    ...history,
    [today]: { done: prev.done + 1, correct: prev.correct + (correct ? 1 : 0) },
  };
  const keys = Object.keys(merged).sort();
  if (keys.length <= HISTORY_DAYS_LIMIT) return merged;
  const trimmed: Record<string, DailyTally> = {};
  for (const key of keys.slice(-HISTORY_DAYS_LIMIT)) {
    const entry = merged[key];
    if (entry) trimmed[key] = entry;
  }
  return trimmed;
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
        dailyHistory: appendDailyHistory(state.dailyHistory, streak.lastDrillDate, correct),
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
  markDailyComplete: (outcomes) =>
    set({
      dailyCompletedDate: localDateKey(),
      dailyOutcomes: outcomes.slice(0, 7).map(Boolean),
    }),
  awardXp: (safe) => set((state) => ({ xp: xpAfterAward(state.xp, safe) })),
  completeLesson: (id) =>
    set((state) => {
      const alreadyDone = state.completedLessons.includes(id);
      const streak = bumpStreak(state.lastDrillDate, state.dailyStreak);
      return {
        ...streak,
        recordStreak: Math.max(state.recordStreak, streak.dailyStreak),
        completedLessons: withLessonComplete(state.completedLessons, id),
        xp: alreadyDone ? state.xp : state.xp + XP_PER_LESSON,
      };
    }),
  recordPuzzleRun: (length) =>
    set((state) => ({
      bestPuzzleStreak: Math.max(state.bestPuzzleStreak, length),
    })),
  markPracticeMove: (avoidedBlunder, madeBlunder) =>
    set((state) => {
      const streak = !madeBlunder
        ? bumpStreak(state.lastDrillDate, state.dailyStreak)
        : { dailyStreak: state.dailyStreak, lastDrillDate: state.lastDrillDate };
      return {
        ...streak,
        recordStreak: Math.max(state.recordStreak, streak.dailyStreak),
        practiceMoves: state.practiceMoves + 1,
        blundersAvoided: state.blundersAvoided + (avoidedBlunder ? 1 : 0),
        blundersMade: state.blundersMade + (madeBlunder ? 1 : 0),
      };
    }),
});
