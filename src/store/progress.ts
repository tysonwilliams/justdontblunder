import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DrillTheme } from '@/src/logic/drills';
import { applyDrillResult } from '@/src/store/drillStats';

export type ThemeTally = { attempts: number; correct: number };

export type ProgressState = {
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
  missedDate: string | null;
  missedIds: string[];
  markDrillResult: (correct: boolean, theme: DrillTheme) => void;
  recordMiss: (drillId: string) => void;
  clearMiss: (drillId: string) => void;
  recordPuzzleRun: (length: number) => void;
  markPracticeMove: (avoidedBlunder: boolean, madeBlunder: boolean) => void;
  resetProgress: () => void;
};

export function missesForDate(
  missedDate: string | null,
  missedIds: string[],
  today = todayKey(),
): string[] {
  if (missedDate !== today) return [];
  return missedIds;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function bumpStreak(lastDrillDate: string | null, dailyStreak: number): {
  dailyStreak: number;
  lastDrillDate: string;
} {
  const today = todayKey();
  if (lastDrillDate === today) {
    return { dailyStreak, lastDrillDate: today };
  }
  if (lastDrillDate === yesterdayKey()) {
    return { dailyStreak: dailyStreak + 1, lastDrillDate: today };
  }
  return { dailyStreak: 1, lastDrillDate: today };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
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
      missedDate: null,
      missedIds: [],
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
          };
        }),
      recordMiss: (drillId) =>
        set((state) => {
          const today = todayKey();
          const current = state.missedDate === today ? state.missedIds : [];
          if (current.includes(drillId)) {
            return { missedDate: today, missedIds: current };
          }
          return { missedDate: today, missedIds: [...current, drillId] };
        }),
      clearMiss: (drillId) =>
        set((state) => {
          const today = todayKey();
          if (state.missedDate !== today) return { missedDate: today, missedIds: [] };
          return { missedIds: state.missedIds.filter((id) => id !== drillId) };
        }),
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
      resetProgress: () =>
        set({
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
          missedDate: null,
          missedIds: [],
        }),
    }),
    {
      name: 'jdb-progress-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProgressState>;
        return {
          ...current,
          ...saved,
          bestPuzzleStreak: saved.bestPuzzleStreak ?? 0,
          themeStats: saved.themeStats ?? {},
          missedDate: saved.missedDate ?? null,
          missedIds: saved.missedIds ?? [],
        };
      },
    },
  ),
);
