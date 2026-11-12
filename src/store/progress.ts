import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

import type { DrillPosition, DrillTheme } from '@/src/logic/drills';
import { profileFromSaved, type GameProfile } from '@/src/logic/gameImport';
import { withLessonComplete } from '@/src/logic/lessons';
import { PUZZLE_POOL_SIZE, keepOwnDrills, mergeOwnDrills } from '@/src/logic/puzzlePool';
import {
  noteSave,
  parseDrillList,
  rememberBankMiss,
  rememberPosition,
  reviewFromSaved,
  type ReviewEntry,
} from '@/src/logic/reviewPile';
import { applyDrillResult } from '@/src/store/drillStats';
import { progressStorage } from '@/src/store/progressStorage';
import { xpAfterAward } from '@/src/store/xp';

export type Experience = 'new' | 'basics';

export type ThemeTally = { attempts: number; correct: number };

export type ScanPhase = 'idle' | 'scanning' | 'done' | 'error';

export type ScanProgress = {
  phase: ScanPhase;
  found: number;
  games: number;
  message: string;
  /** True while this scan may still add blunders. */
  incoming: boolean;
};

const IDLE_SCAN: ScanProgress = { phase: 'idle', found: 0, games: 0, message: '', incoming: false };

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
  /** Misses and personal positions. They stay until saved twice. */
  review: ReviewEntry[];
  completedLessons: string[];
  xp: number;
  experience: Experience | null;
  welcomeSkipped: boolean;
  /** Public username the puzzles were built from. */
  gameProfile: GameProfile | null;
  drillsPromptSkipped: boolean;
  /** Newest personal blunders. The starter set fills this out to 100 at play time. */
  ownDrills: DrillPosition[];
  scan: ScanProgress;
  /** The player started the drills behind the username prompt. The scan can keep running. */
  scanPromptDismissed: boolean;
  markDrillResult: (correct: boolean, theme: DrillTheme) => void;
  awardXp: (safe: boolean) => void;
  setExperience: (value: Experience | null) => void;
  skipWelcome: () => void;
  skipDrillsPrompt: () => void;
  saveGameProfile: (profile: GameProfile) => void;
  setScan: (scan: ScanProgress) => void;
  dismissScanPrompt: () => void;
  completeLesson: (id: string) => void;
  recordMiss: (drillId: string) => void;
  /** One correct review. The second one removes the position. */
  recordSave: (drillId: string) => void;
  savePersonalDrill: (drill: DrillPosition) => void;
  saveImportedDrills: (drills: readonly DrillPosition[]) => void;
  mergeImportedDrills: (drills: readonly DrillPosition[]) => void;
  recordPuzzleRun: (length: number) => void;
  markPracticeMove: (avoidedBlunder: boolean, madeBlunder: boolean) => void;
  resetProgress: () => void;
};

/** Ids still in the review pile. A previous day does not clear them. */
export function missesForDate(
  missedDate: string | null,
  missedIds: string[],
  today = todayKey(),
): string[] {
  void missedDate;
  void today;
  return missedIds;
}

function withReview(review: ReviewEntry[]): { review: ReviewEntry[]; missedIds: string[] } {
  return { review, missedIds: review.map((entry) => entry.id) };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function scanFromSaved(value: unknown): ScanProgress {
  if (!value || typeof value !== 'object') return IDLE_SCAN;
  const scan = value as Partial<ScanProgress>;
  if (scan.phase !== 'done' && scan.phase !== 'error' && scan.phase !== 'idle') return IDLE_SCAN;
  return {
    phase: scan.phase,
    found: typeof scan.found === 'number' ? scan.found : 0,
    games: typeof scan.games === 'number' ? scan.games : 0,
    message: typeof scan.message === 'string' ? scan.message : '',
    incoming: false,
  };
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
      review: [],
      completedLessons: [],
      xp: 0,
      experience: null,
      welcomeSkipped: false,
      gameProfile: null,
      drillsPromptSkipped: false,
      ownDrills: [],
      scan: IDLE_SCAN,
      scanPromptDismissed: false,
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
      setExperience: (value) => set({ experience: value, welcomeSkipped: false }),
      skipWelcome: () => set({ welcomeSkipped: true }),
      skipDrillsPrompt: () => set({ drillsPromptSkipped: true }),
      saveGameProfile: (profile) => set({ gameProfile: profile }),
      setScan: (scan) => set({ scan }),
      dismissScanPrompt: () => set({ scanPromptDismissed: true }),
      completeLesson: (id) =>
        set((state) => ({ completedLessons: withLessonComplete(state.completedLessons, id) })),
      recordMiss: (drillId) => set((state) => withReview(rememberBankMiss(state.review, drillId))),
      recordSave: (drillId) => set((state) => withReview(noteSave(state.review, drillId))),
      savePersonalDrill: (drill) => set((state) => withReview(rememberPosition(state.review, drill))),
      saveImportedDrills: (drills) => set({ ownDrills: keepOwnDrills(drills, PUZZLE_POOL_SIZE) }),
      mergeImportedDrills: (drills) =>
        set((state) => ({ ownDrills: mergeOwnDrills(state.ownDrills, drills, PUZZLE_POOL_SIZE) })),
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
          review: [],
          completedLessons: [],
          xp: 0,
          experience: null,
          welcomeSkipped: false,
          gameProfile: null,
          drillsPromptSkipped: false,
          ownDrills: [],
          scan: IDLE_SCAN,
          scanPromptDismissed: false,
        }),
    }),
    {
      name: 'jdb-progress-v1',
      storage: progressStorage as unknown as PersistStorage<ProgressState>,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProgressState>;
        const review = reviewFromSaved(saved);
        return {
          ...current,
          ...saved,
          bestPuzzleStreak: saved.bestPuzzleStreak ?? 0,
          themeStats: saved.themeStats ?? {},
          missedDate: saved.missedDate ?? null,
          ...withReview(review),
          completedLessons: saved.completedLessons ?? [],
          xp: saved.xp ?? 0,
          experience: saved.experience ?? null,
          welcomeSkipped: saved.welcomeSkipped ?? false,
          gameProfile: profileFromSaved(saved.gameProfile),
          drillsPromptSkipped: saved.drillsPromptSkipped ?? false,
          ownDrills: parseDrillList(saved.ownDrills, PUZZLE_POOL_SIZE),
          scan: scanFromSaved(saved.scan),
          scanPromptDismissed: false,
        };
      },
    },
  ),
);
