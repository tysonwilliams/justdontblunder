import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ProgressState = {
  dailyStreak: number;
  lastDrillDate: string | null;
  drillsCompleted: number;
  drillsCorrect: number;
  blundersAvoided: number;
  blundersMade: number;
  practiceMoves: number;
  habitTutorialDone: boolean;
  recordStreak: number;
  markDrillResult: (correct: boolean) => void;
  markPracticeMove: (avoidedBlunder: boolean, madeBlunder: boolean) => void;
  completeHabitTutorial: () => void;
  resetProgress: () => void;
};

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
      habitTutorialDone: false,
      recordStreak: 0,
      markDrillResult: (correct) =>
        set((state) => {
          const streak = bumpStreak(state.lastDrillDate, state.dailyStreak);
          return {
            ...streak,
            drillsCompleted: state.drillsCompleted + 1,
            drillsCorrect: state.drillsCorrect + (correct ? 1 : 0),
            blundersAvoided: state.blundersAvoided + (correct ? 1 : 0),
            blundersMade: state.blundersMade + (correct ? 0 : 1),
            recordStreak: Math.max(state.recordStreak, streak.dailyStreak),
          };
        }),
      markPracticeMove: (avoidedBlunder, madeBlunder) =>
        set((state) => ({
          practiceMoves: state.practiceMoves + 1,
          blundersAvoided: state.blundersAvoided + (avoidedBlunder ? 1 : 0),
          blundersMade: state.blundersMade + (madeBlunder ? 1 : 0),
        })),
      completeHabitTutorial: () => set({ habitTutorialDone: true }),
      resetProgress: () =>
        set({
          dailyStreak: 0,
          lastDrillDate: null,
          drillsCompleted: 0,
          drillsCorrect: 0,
          blundersAvoided: 0,
          blundersMade: 0,
          practiceMoves: 0,
          habitTutorialDone: false,
          recordStreak: 0,
        }),
    }),
    {
      name: 'jdb-progress-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
