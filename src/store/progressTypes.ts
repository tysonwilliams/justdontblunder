import type { DrillPosition, DrillTheme } from '@/src/logic/drills';
import type { GameProfile } from '@/src/logic/gameImport';
import type { ReviewEntry } from '@/src/logic/reviewPile';

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
  /** Misses and personal positions. They stay until saved twice. */
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
  /** One correct review. The second one removes the position. */
  recordSave: (drillId: string) => void;
  savePersonalDrill: (drill: DrillPosition) => void;
  saveGameProfile: (profile: GameProfile) => void;
  saveImportedDrills: (drills: readonly DrillPosition[]) => void;
  mergeImportedDrills: (drills: readonly DrillPosition[]) => void;
  setExperience: (value: Experience | null) => void;
  skipWelcome: () => void;
  skipDrillsPrompt: () => void;
  setScan: (scan: ScanProgress) => void;
  dismissScanPrompt: () => void;
  resetProgress: () => void;
};
