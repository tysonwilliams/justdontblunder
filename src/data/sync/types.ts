import type { DrillPosition } from '@/src/logic/drills';
import type { GameSite } from '@/src/logic/scanCursor';
import type { PersistedProgress } from '@/src/store/progressMigrate';

export type SyncOutcome = 'safe' | 'blunder';

export type SyncAttempt = {
  clientId: string;
  drillId: string;
  move: string;
  outcome: SyncOutcome;
  createdAt: string;
};

/** Due date and miss notes copied from the review schedule. */
export type ReviewMeta = {
  id: string;
  dueOn: string | null;
  /** Unpacked gap in days. 0 means due now. */
  intervalDays: number;
  missHistory: string[];
};

/**
 * The version-2 `jdb-progress-v1` slices, plus the rows that have no local column:
 * attempts, streak dates, review due dates, and the last scan time.
 */
export type SyncSnapshot = {
  timezone: string;
  progress: PersistedProgress;
  attempts: SyncAttempt[];
  streakDates: string[];
  lastScannedAt: string | null;
  reviewMeta: ReviewMeta[];
};

export type ProfileWrite = {
  id: string;
  timezone: string;
  experience: 'new' | 'basics' | null;
  welcome_skipped: boolean;
  drills_prompt_skipped: boolean;
  missed_date: string | null;
  daily_streak: number;
  last_drill_date: string | null;
  drills_completed: number;
  drills_correct: number;
  blunders_avoided: number;
  blunders_made: number;
  practice_moves: number;
  theme_stats: Record<string, { attempts: number; correct: number }>;
  record_streak: number;
  best_puzzle_streak: number;
  xp: number;
  completed_lessons: string[];
  scan_phase: 'idle' | 'paused' | 'done' | 'error';
  scan_found: number;
  scan_games: number;
  scan_message: string;
};

export type LinkedAccountWrite = {
  user_id: string;
  provider: GameSite;
  username: string;
  /** Omitted for Lichess so a later verification is left alone. Chess.com is always false. */
  verified?: false;
  last_scanned_at: string | null;
  scan_cursor: Record<string, unknown> | null;
};

export type ScannedGameWrite = {
  user_id: string;
  provider: GameSite;
  game_id: string;
};

export type PositionWrite = {
  fen_key: string;
  fen: string;
  theme: DrillPosition['theme'];
  side_to_move: 'w' | 'b';
  at_risk_square: string;
  prompt: string;
  solution: string[];
  acceptable: string[];
  traps: DrillPosition['traps'];
  note: string;
  expected_drop_cp: number;
};

export type UserDrillWrite = {
  user_id: string;
  local_id: string;
  puzzle_id: string | null;
  fen_key: string | null;
  source_game_id: string | null;
  source_move: string | null;
  pasted: boolean;
  sort_index: number;
};

export type ReviewWrite = {
  user_id: string;
  puzzle_id: string | null;
  fen_key: string | null;
  local_id: string | null;
  /** Legacy column. The scheduler writes 0. The gap lives in interval_days. */
  saves: 0 | 1;
  miss_history: string[];
  due_on: string | null;
  /** 0, or 100 * consecutive saves + the interval (1, 3, 7, 16, or 35). */
  interval_days: number;
  pile_index: number;
};

export type AttemptWrite = {
  user_id: string;
  client_id: string;
  puzzle_id: string | null;
  fen_key: string | null;
  move: string;
  outcome: SyncOutcome;
  created_at: string;
};

export type RemoteRows = {
  profile: ProfileWrite;
  linkedAccounts: LinkedAccountWrite[];
  scannedGames: ScannedGameWrite[];
  positions: PositionWrite[];
  userDrills: UserDrillWrite[];
  reviewEntries: ReviewWrite[];
  attempts: AttemptWrite[];
  streakDates: string[];
  /** Provider whose scanned_games list is the full seen set. Null skips deletion. */
  scannedProvider: GameSite | null;
};

export type ProfileRow = ProfileWrite & { id: string };

export type LinkedAccountRow = {
  id?: number;
  user_id: string;
  provider: string;
  username: string;
  verified?: boolean;
  last_scanned_at: string | null;
  scan_cursor: unknown;
};

export type ScannedGameRow = {
  id?: number;
  user_id: string;
  provider: string;
  game_id: string;
};

export type PositionRow = PositionWrite & { id: number };

export type PuzzleRow = {
  id: string;
  fen: string;
  theme: string;
  side_to_move: string;
  at_risk_square: string;
  prompt: string;
  solution: unknown;
  acceptable: unknown;
  traps: unknown;
  note: string;
  expected_drop_cp: number;
};

export type UserDrillRow = {
  id: number;
  user_id: string;
  local_id: string;
  puzzle_id: string | null;
  position_id: number | null;
  source_game_id: string | null;
  source_move: string | null;
  pasted: boolean;
  sort_index: number;
};

export type ReviewRow = {
  id: number;
  user_id: string;
  user_drill_id: number | null;
  puzzle_id: string | null;
  position_id: number | null;
  saves: number;
  miss_history: unknown;
  due_on: string | null;
  interval_days: number;
  pile_index: number;
};

export type AttemptRow = {
  id?: number;
  user_id: string;
  client_id: string;
  user_drill_id?: number | null;
  puzzle_id: string | null;
  position_id: number | null;
  move: string;
  outcome: string;
  created_at: string;
};

export type StreakRow = {
  user_id: string;
  local_date: string;
};

export type RemoteRead = {
  profile: ProfileRow | null;
  linkedAccounts: LinkedAccountRow[];
  scannedGames: ScannedGameRow[];
  positions: PositionRow[];
  puzzles: PuzzleRow[];
  userDrills: UserDrillRow[];
  reviewEntries: ReviewRow[];
  attempts: AttemptRow[];
  streakDates: string[];
};

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export type SyncResult = {
  data: unknown;
  error: { message: string } | null;
};

/** The slice of the Supabase client the sync repo uses. Tests pass a fake. */
export interface SyncQuery extends PromiseLike<SyncResult> {
  select(columns?: string): SyncQuery;
  insert(values: unknown): SyncQuery;
  upsert(values: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): SyncQuery;
  update(values: unknown): SyncQuery;
  delete(): SyncQuery;
  eq(column: string, value: unknown): SyncQuery;
  in(column: string, values: readonly unknown[]): SyncQuery;
  order(column: string, options?: { ascending?: boolean }): SyncQuery;
  range(from: number, to: number): SyncQuery;
}

export interface SyncClient {
  from(table: string): SyncQuery;
}

export interface ProgressRepo {
  load(): Promise<PersistedProgress>;
  save(progress: PersistedProgress): Promise<void>;
  pull(): Promise<SyncSnapshot | null>;
  push(snapshot: SyncSnapshot): Promise<void>;
  /** Pull, union with the guest snapshot, save locally, then push. */
  mergeOnSignIn(guest: SyncSnapshot): Promise<PersistedProgress>;
}
