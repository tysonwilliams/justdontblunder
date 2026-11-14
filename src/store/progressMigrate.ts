import type { DrillTheme } from '@/src/logic/drills';
import { profileFromSaved } from '@/src/logic/gameImport';
import { PUZZLE_POOL_SIZE } from '@/src/logic/puzzlePool';
import { parseDrillList, reviewFromSaved, type ReviewEntry } from '@/src/logic/reviewPile';
import { scanFromSaved } from '@/src/store/slices/scan';
import type { Experience, ProgressState, ScanProgress, ThemeTally } from '@/src/store/progressTypes';

/**
 * v0 is the flat `jdb-progress-v1` document.
 * v1 splits it into training, review, library, preferences, and scan.
 * Scan stays in the document so a refresh can show the last result. A later
 * sync can ship the other slices and leave scan on the device.
 */
export const PROGRESS_VERSION = 1;

export const PROGRESS_STORAGE_KEY = 'jdb-progress-v1';

const THEMES: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

export type PersistedTraining = {
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

export type PersistedReview = {
  missedDate: string | null;
  missedIds: string[];
  review: ReviewEntry[];
};

export type PersistedLibrary = {
  ownDrills: ProgressState['ownDrills'];
  pastedIds: string[];
  gameProfile: ProgressState['gameProfile'];
};

export type PersistedPreferences = {
  experience: Experience | null;
  welcomeSkipped: boolean;
  drillsPromptSkipped: boolean;
};

export type PersistedProgress = {
  training: PersistedTraining;
  review: PersistedReview;
  library: PersistedLibrary;
  preferences: PersistedPreferences;
  scan: ScanProgress;
};

export function blankPersisted(): PersistedProgress {
  return {
    training: {
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
    },
    review: { missedDate: null, missedIds: [], review: [] },
    library: { ownDrills: [], pastedIds: [], gameProfile: null },
    preferences: { experience: null, welcomeSkipped: false, drillsPromptSkipped: false },
    scan: scanFromSaved(undefined),
  };
}

export function partializeProgress(state: ProgressState): PersistedProgress {
  return {
    training: {
      dailyStreak: state.dailyStreak,
      lastDrillDate: state.lastDrillDate,
      drillsCompleted: state.drillsCompleted,
      drillsCorrect: state.drillsCorrect,
      blundersAvoided: state.blundersAvoided,
      blundersMade: state.blundersMade,
      practiceMoves: state.practiceMoves,
      themeStats: state.themeStats,
      recordStreak: state.recordStreak,
      bestPuzzleStreak: state.bestPuzzleStreak,
      xp: state.xp,
      completedLessons: state.completedLessons,
    },
    review: {
      missedDate: state.missedDate,
      missedIds: state.review.map((entry) => entry.id),
      review: state.review,
    },
    library: {
      ownDrills: state.ownDrills,
      pastedIds: state.pastedIds,
      gameProfile: state.gameProfile,
    },
    preferences: {
      experience: state.experience,
      welcomeSkipped: state.welcomeSkipped,
      drillsPromptSkipped: state.drillsPromptSkipped,
    },
    scan: { ...state.scan },
  };
}

export function migrateProgress(persisted: unknown, version: number): PersistedProgress {
  if (version < PROGRESS_VERSION) return persistedFromLegacy(persisted);
  return persistedFromSlices(persisted);
}

export function mergeProgress(persisted: unknown, current: ProgressState): ProgressState {
  if (persisted == null) return { ...current, scanPromptDismissed: false };
  const saved = isSliced(persisted) ? persistedFromSlices(persisted) : persistedFromLegacy(persisted);
  return applyPersisted(current, saved);
}

export function applyPersisted(current: ProgressState, saved: PersistedProgress): ProgressState {
  return {
    ...current,
    ...saved.training,
    missedDate: saved.review.missedDate,
    review: saved.review.review,
    missedIds: saved.review.missedIds,
    ownDrills: saved.library.ownDrills,
    pastedIds: saved.library.pastedIds,
    gameProfile: saved.library.gameProfile,
    experience: saved.preferences.experience,
    welcomeSkipped: saved.preferences.welcomeSkipped,
    drillsPromptSkipped: saved.preferences.drillsPromptSkipped,
    scan: saved.scan,
    scanPromptDismissed: false,
  };
}

function persistedFromLegacy(value: unknown): PersistedProgress {
  const saved = asRecord(value) ?? {};
  const review = readReview(saved.review, saved.missedIds);
  return {
    training: readTraining(saved),
    review: {
      missedDate: readText(saved.missedDate, null),
      review,
      missedIds: review.map((entry) => entry.id),
    },
    library: {
      ownDrills: parseDrillList(saved.ownDrills, PUZZLE_POOL_SIZE),
      pastedIds: readIdList(saved.pastedIds),
      gameProfile: profileFromSaved(saved.gameProfile),
    },
    preferences: {
      experience: readExperience(saved.experience),
      welcomeSkipped: readFlag(saved.welcomeSkipped),
      drillsPromptSkipped: readFlag(saved.drillsPromptSkipped),
    },
    scan: scanFromSaved(saved.scan),
  };
}

function persistedFromSlices(value: unknown): PersistedProgress {
  const saved = asRecord(value) ?? {};
  const reviewRecord = asRecord(saved.review);
  const library = asRecord(saved.library);
  const preferences = asRecord(saved.preferences);
  const review = readReview(reviewRecord?.review, reviewRecord?.missedIds);
  return {
    training: readTraining(asRecord(saved.training) ?? {}),
    review: {
      missedDate: readText(reviewRecord?.missedDate, null),
      review,
      missedIds: review.map((entry) => entry.id),
    },
    library: {
      ownDrills: parseDrillList(library?.ownDrills, PUZZLE_POOL_SIZE),
      pastedIds: readIdList(library?.pastedIds),
      gameProfile: profileFromSaved(library?.gameProfile),
    },
    preferences: {
      experience: readExperience(preferences?.experience),
      welcomeSkipped: readFlag(preferences?.welcomeSkipped),
      drillsPromptSkipped: readFlag(preferences?.drillsPromptSkipped),
    },
    scan: scanFromSaved(saved.scan),
  };
}

function readTraining(saved: Record<string, unknown>): PersistedTraining {
  return {
    dailyStreak: readCount(saved.dailyStreak),
    lastDrillDate: readText(saved.lastDrillDate, null),
    drillsCompleted: readCount(saved.drillsCompleted),
    drillsCorrect: readCount(saved.drillsCorrect),
    blundersAvoided: readCount(saved.blundersAvoided),
    blundersMade: readCount(saved.blundersMade),
    practiceMoves: readCount(saved.practiceMoves),
    themeStats: readThemeStats(saved.themeStats),
    recordStreak: readCount(saved.recordStreak),
    bestPuzzleStreak: readCount(saved.bestPuzzleStreak),
    xp: readCount(saved.xp),
    completedLessons: readIdList(saved.completedLessons),
  };
}

function readReview(review: unknown, missedIds: unknown): ReviewEntry[] {
  return reviewFromSaved({ review, missedIds });
}

/** The old flat blob has `review` and `scan`. Slices add these three objects. */
function isSliced(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  return 'training' in record && 'library' in record && 'preferences' in record;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readText(value: unknown, fallback: string | null): string | null {
  if (typeof value === 'string') return value;
  if (value === null) return null;
  return fallback;
}

function readFlag(value: unknown): boolean {
  return value === true;
}

function readExperience(value: unknown): Experience | null {
  if (value === 'new' || value === 'basics') return value;
  return null;
}

function readIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function readThemeStats(value: unknown): Partial<Record<DrillTheme, ThemeTally>> {
  const record = asRecord(value);
  if (!record) return {};
  const out: Partial<Record<DrillTheme, ThemeTally>> = {};
  for (const theme of THEMES) {
    const tally = asRecord(record[theme]);
    if (!tally) continue;
    if (typeof tally.attempts !== 'number' || !Number.isFinite(tally.attempts)) continue;
    if (typeof tally.correct !== 'number' || !Number.isFinite(tally.correct)) continue;
    out[theme] = { attempts: tally.attempts, correct: tally.correct };
  }
  return out;
}
