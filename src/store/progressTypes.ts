import type { DrillPosition, DrillTheme } from '@/src/logic/drills';
import type { GameProfile } from '@/src/logic/gameImport';
import type { ReviewEntry } from '@/src/logic/reviewPile';
import type { ScanCursor } from '@/src/logic/scanCursor';

export type Experience = 'new' | 'basics' | 'intermediate';

export type ThemeTally = { attempts: number; correct: number };

export type ScanPhase = 'idle' | 'scanning' | 'paused' | 'done' | 'error';

export type ScanProgress = {
  phase: ScanPhase;
  found: number;
  games: number;
  message: string;
  /** True while this scan may still add blunders. */
  incoming: boolean;
  /** Games already read. A later scan of the same username continues from here. */
  cursor: ScanCursor | null;
};

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
  xp: number;
  completedLessons: string[];
  missedDate: string | null;
  missedIds: string[];
  /** Misses and personal positions, each with a due date. */
  review: ReviewEntry[];
  experience: Experience | null;
  welcomeSkipped: boolean;
  /** Public username the puzzles were built from. */
  gameProfile: GameProfile | null;
  drillsPromptSkipped: boolean;
  /** Newest personal blunders. The starter set fills this out to 100 at play time. */
  ownDrills: DrillPosition[];
  /** Ids from a pasted PGN. A username scan keeps these when that position is not in the scan. */
  pastedIds: string[];
  scan: ScanProgress;
  /** The player started the drills behind the username prompt. The scan can keep running. */
  scanPromptDismissed: boolean;
  markDrillResult: (correct: boolean, theme: DrillTheme) => void;
  awardXp: (safe: boolean) => void;
  completeLesson: (id: string) => void;
  recordPuzzleRun: (length: number) => void;
  markPracticeMove: (avoidedBlunder: boolean, madeBlunder: boolean) => void;
  recordMiss: (drillId: string, drill?: DrillPosition) => void;
  /** One correct review. The next gap follows 1, 3, 7, 16, and 35 days. */
  recordSave: (drillId: string) => void;
  savePersonalDrill: (drill: DrillPosition) => void;
  saveGameProfile: (profile: GameProfile) => void;
  clearGameProfile: () => void;
  saveImportedDrills: (drills: readonly DrillPosition[]) => void;
  mergeImportedDrills: (drills: readonly DrillPosition[]) => void;
  setExperience: (value: Experience | null) => void;
  skipWelcome: () => void;
  skipDrillsPrompt: () => void;
  setScan: (scan: ScanProgress) => void;
  dismissScanPrompt: () => void;
  resetProgress: () => void;
};
