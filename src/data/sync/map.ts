import beginnerBlunders from '@/src/data/beginner-blunders.json';

import { cleanTimeZone, isCalendarDate, whole } from '@/src/data/sync/dates';
import { isPublicGameId } from '@/src/data/sync/gameIds';
import type {
  AttemptWrite,
  LinkedAccountRow,
  LinkedAccountWrite,
  PositionRow,
  PositionWrite,
  ProfileWrite,
  PuzzleRow,
  RemoteRead,
  RemoteRows,
  ReviewMeta,
  ReviewRow,
  ReviewWrite,
  ScannedGameWrite,
  SyncAttempt,
  SyncSnapshot,
  UserDrillRow,
  UserDrillWrite,
} from '@/src/data/sync/types';
import type { DrillPosition, DrillTheme } from '@/src/logic/drills';
import { ownDrillId } from '@/src/logic/personalDrill';
import { profileFromSaved } from '@/src/logic/gameImport';
import { isDateKey, localDateKey } from '@/src/logic/localDate';
import { fenKey, parseDrillList, reviewFromSaved, type ReviewEntry } from '@/src/logic/reviewPile';
import {
  packIntervalDays,
  scheduleFromSaved,
  scheduleFromStored,
  type ReviewSchedule,
} from '@/src/logic/reviewSchedule';
import { cleanUsername, cursorFromSaved, type GameSite, type ScanCursor } from '@/src/logic/scanCursor';
import type { Experience, ScanPhase } from '@/src/store/progressTypes';
import type { PersistedProgress } from '@/src/store/progressMigrate';
import { scanFromSaved } from '@/src/store/slices/scan';

const THEMES: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];
const CATALOG = new Set((beginnerBlunders as { id: string }[]).map((row) => row.id));
const SQUARE = /^[a-h][1-8]$/;

export function isCatalogId(id: string): boolean {
  return CATALOG.has(id);
}

export function snapshotFromProgress(
  progress: PersistedProgress,
  options?: {
    timezone?: string | null;
    attempts?: readonly SyncAttempt[];
    streakDates?: readonly string[];
    lastScannedAt?: string | null;
    reviewMeta?: readonly ReviewMeta[];
  },
): SyncSnapshot {
  const dates = new Set<string>();
  for (const date of options?.streakDates ?? []) {
    if (isCalendarDate(date)) dates.add(date);
  }
  if (progress.training.lastDrillDate && isCalendarDate(progress.training.lastDrillDate)) {
    dates.add(progress.training.lastDrillDate);
  }
  return {
    timezone: cleanTimeZone(options?.timezone) ?? 'UTC',
    progress,
    attempts: dedupeAttempts(options?.attempts ?? []),
    streakDates: [...dates].sort(),
    lastScannedAt: options?.lastScannedAt ?? null,
    reviewMeta: (options?.reviewMeta ?? []).filter((meta) =>
      progress.review.review.some((entry) => entry.id === meta.id),
    ),
  };
}

export function rowsFromSnapshot(snapshot: SyncSnapshot, userId: string): RemoteRows {
  const progress = snapshot.progress;
  const drills = libraryDrills(progress);
  const pasted = new Set(progress.library.pastedIds);
  const positions: PositionWrite[] = [];
  const positionKeys = new Set<string>();
  const userDrills: UserDrillWrite[] = [];
  const drillKeys = new Map<string, string>();

  drills.forEach((drill, index) => {
    const source = publicSource(drill.source);
    if (isCatalogId(drill.id)) {
      userDrills.push({
        user_id: userId,
        local_id: drill.id,
        puzzle_id: drill.id,
        fen_key: null,
        source_game_id: source?.gameId ?? null,
        source_move: source?.move ?? null,
        pasted: pasted.has(drill.id),
        sort_index: index,
      });
      return;
    }
    const position = positionFromDrill(drill);
    if (!position) return;
    if (!positionKeys.has(position.fen_key)) {
      positionKeys.add(position.fen_key);
      positions.push(position);
    }
    drillKeys.set(drill.id, position.fen_key);
    userDrills.push({
      user_id: userId,
      local_id: drill.id,
      puzzle_id: null,
      fen_key: position.fen_key,
      source_game_id: source?.gameId ?? null,
      source_move: source?.move ?? null,
      pasted: pasted.has(drill.id),
      sort_index: index,
    });
  });

  const today = localDateKey();
  const metaById = new Map(snapshot.reviewMeta.map((meta) => [meta.id, meta]));
  const reviewEntries: ReviewWrite[] = [];
  progress.review.review.forEach((entry, index) => {
    const row = reviewRow(entry, metaById.get(entry.id), today, drillKeys, userId, index);
    if (row) reviewEntries.push(row);
  });

  const attempts: AttemptWrite[] = [];
  for (const attempt of snapshot.attempts) {
    const row = attemptRow(attempt, drillKeys, userId);
    if (row) attempts.push(row);
  }

  const cursor = progress.scan.cursor;
  const linkedAccounts = linkedRows(snapshot, userId);
  return {
    profile: profileRow(snapshot, userId),
    linkedAccounts,
    scannedGames: scannedRows(progress, userId),
    positions,
    userDrills,
    reviewEntries,
    attempts,
    streakDates: snapshot.streakDates.filter(isCalendarDate),
    scannedProvider: cursor ? cursor.site : null,
  };
}

export function snapshotFromRows(read: RemoteRead): SyncSnapshot | null {
  if (!read.profile) return null;
  const profile = read.profile;
  const positions = new Map(read.positions.map((row) => [row.id, row]));
  const puzzles = new Map(read.puzzles.map((row) => [row.id, row]));
  const drills: DrillPosition[] = [];
  const pastedIds: string[] = [];
  const localByPosition = new Map<number, string>();
  const sortedDrills = [...read.userDrills].sort((a, b) => a.sort_index - b.sort_index || a.local_id.localeCompare(b.local_id));
  for (const row of sortedDrills) {
    const drill = drillFromUserRow(row, positions, puzzles);
    if (!drill) continue;
    drills.push(drill);
    if (row.position_id != null) localByPosition.set(row.position_id, drill.id);
    if (row.pasted) pastedIds.push(drill.id);
  }
  const ownDrills = parseDrillList(drills, drills.length);
  const live = new Set(ownDrills.map((drill) => drill.id));

  const review: ReviewEntry[] = [];
  const reviewMeta: ReviewMeta[] = [];
  const sortedReview = [...read.reviewEntries].sort((a, b) => a.pile_index - b.pile_index || a.id - b.id);
  for (const row of sortedReview) {
    const built = reviewFromRow(row, positions, localByPosition, puzzles);
    if (!built) continue;
    review.push(built.entry);
    reviewMeta.push(built.meta);
  }
  const cleaned = reviewFromSaved({ review, missedIds: review.map((entry) => entry.id) });

  const account = pickAccount(read.linkedAccounts);
  const cursor = account ? cursorForAccount(account, read.scannedGames) : null;
  const scan = scanFromSaved({
    phase: profile.scan_phase,
    found: whole(profile.scan_found),
    games: whole(profile.scan_games),
    message: typeof profile.scan_message === 'string' ? profile.scan_message : '',
    incoming: false,
    cursor,
  });

  const progress: PersistedProgress = {
    training: {
      dailyStreak: whole(profile.daily_streak),
      lastDrillDate: dateOrNull(profile.last_drill_date),
      drillsCompleted: whole(profile.drills_completed),
      drillsCorrect: whole(profile.drills_correct),
      blundersAvoided: whole(profile.blunders_avoided),
      blundersMade: whole(profile.blunders_made),
      practiceMoves: whole(profile.practice_moves),
      themeStats: themeStats(profile.theme_stats),
      recordStreak: whole(profile.record_streak),
      bestPuzzleStreak: whole(profile.best_puzzle_streak),
      xp: whole(profile.xp),
      completedLessons: idList(profile.completed_lessons),
    },
    review: {
      missedDate: dateOrNull(profile.missed_date),
      review: cleaned,
      missedIds: cleaned.map((entry) => entry.id),
    },
    library: {
      ownDrills,
      pastedIds: pastedIds.filter((id) => live.has(id)),
      gameProfile: account ? profileFromSaved({ site: account.provider, username: account.username }) : null,
    },
    preferences: {
      experience: experience(profile.experience),
      welcomeSkipped: profile.welcome_skipped === true,
      drillsPromptSkipped: profile.drills_prompt_skipped === true,
    },
    scan,
  };

  const attempts: SyncAttempt[] = [];
  for (const row of read.attempts) {
    const attempt = attemptFromRow(row, localByPosition);
    if (attempt) attempts.push(attempt);
  }

  return snapshotFromProgress(progress, {
    timezone: profile.timezone,
    attempts,
    streakDates: read.streakDates,
    lastScannedAt: account?.last_scanned_at ?? null,
    reviewMeta,
  });
}

function libraryDrills(progress: PersistedProgress): DrillPosition[] {
  const drills = [...progress.library.ownDrills];
  const seen = new Set(drills.map((drill) => fenKey(drill.fen)));
  for (const entry of progress.review.review) {
    if (!entry.drill || seen.has(fenKey(entry.drill.fen))) continue;
    seen.add(fenKey(entry.drill.fen));
    drills.push(entry.drill);
  }
  return drills;
}

function profileRow(snapshot: SyncSnapshot, userId: string): ProfileWrite {
  const { training, review, preferences, scan } = snapshot.progress;
  return {
    id: userId,
    timezone: snapshot.timezone,
    experience: preferences.experience,
    welcome_skipped: preferences.welcomeSkipped,
    drills_prompt_skipped: preferences.drillsPromptSkipped,
    missed_date: dateOrNull(review.missedDate),
    daily_streak: whole(training.dailyStreak),
    last_drill_date: dateOrNull(training.lastDrillDate),
    drills_completed: whole(training.drillsCompleted),
    drills_correct: whole(training.drillsCorrect),
    blunders_avoided: whole(training.blundersAvoided),
    blunders_made: whole(training.blundersMade),
    practice_moves: whole(training.practiceMoves),
    theme_stats: themeStats(training.themeStats),
    record_streak: whole(training.recordStreak),
    best_puzzle_streak: whole(training.bestPuzzleStreak),
    xp: whole(training.xp),
    completed_lessons: idList(training.completedLessons),
    scan_phase: phaseForRow(scan.phase),
    scan_found: whole(scan.found),
    scan_games: whole(scan.games),
    scan_message: clip(scan.message, 280),
  };
}

function linkedRows(snapshot: SyncSnapshot, userId: string): LinkedAccountWrite[] {
  const cursor = snapshot.progress.scan.cursor;
  const saved = snapshot.progress.library.gameProfile;
  const rows = new Map<GameSite, LinkedAccountWrite>();
  const put = (site: GameSite, username: string, withCursor: boolean) => {
    const name = cleanUsername(username);
    if (!name) return;
    rows.set(site, {
      user_id: userId,
      provider: site,
      username: name,
      verified: site === 'chesscom' ? false : undefined,
      last_scanned_at: snapshot.lastScannedAt,
      scan_cursor: withCursor && cursor && cursor.site === site ? cursorJson(cursor) : null,
    });
  };
  if (saved) put(saved.site, saved.username, true);
  if (cursor && !rows.has(cursor.site)) put(cursor.site, cursor.username, true);
  return [...rows.values()];
}

function scannedRows(progress: PersistedProgress, userId: string): ScannedGameWrite[] {
  const cursor = progress.scan.cursor;
  const rows: ScannedGameWrite[] = [];
  const seen = new Set<string>();
  if (cursor) {
    for (const id of cursor.seen) {
      if (!isPublicGameId(id) || seen.has(id)) continue;
      seen.add(id);
      rows.push({ user_id: userId, provider: cursor.site, game_id: id });
    }
  }
  const fallback = cursor?.site ?? progress.library.gameProfile?.site ?? null;
  for (const drill of libraryDrills(progress)) {
    const id = drill.source?.gameId;
    if (!id || !isPublicGameId(id) || seen.has(id)) continue;
    const provider = providerForGameId(id) ?? fallback;
    if (!provider) continue;
    seen.add(id);
    rows.push({ user_id: userId, provider, game_id: id });
  }
  return rows;
}

function reviewRow(
  entry: ReviewEntry,
  meta: ReviewMeta | undefined,
  today: string,
  drillKeys: Map<string, string>,
  userId: string,
  index: number,
): ReviewWrite | null {
  const schedule = scheduleForWrite(entry, meta, today);
  const base = {
    user_id: userId,
    saves: 0 as const,
    miss_history: cleanHistory(meta?.missHistory ?? []),
    due_on: isCalendarDate(schedule.dueOn) ? schedule.dueOn : null,
    interval_days: packIntervalDays(schedule),
    pile_index: index,
  } as const;
  if (entry.drill && isCatalogId(entry.drill.id)) {
    return { ...base, puzzle_id: entry.drill.id, fen_key: null, local_id: entry.drill.id };
  }
  if (entry.drill) {
    const key = drillKeys.get(entry.drill.id) ?? drillKeys.get(entry.id);
    if (!key) return null;
    return { ...base, puzzle_id: null, fen_key: key, local_id: entry.drill.id };
  }
  if (isCatalogId(entry.id)) {
    return { ...base, puzzle_id: entry.id, fen_key: null, local_id: null };
  }
  const key = drillKeys.get(entry.id);
  if (!key) return null;
  return { ...base, puzzle_id: null, fen_key: key, local_id: entry.id };
}

function attemptRow(attempt: SyncAttempt, drillKeys: Map<string, string>, userId: string): AttemptWrite | null {
  if (!isClientId(attempt.clientId) || !isMove(attempt.move)) return null;
  if (attempt.outcome !== 'safe' && attempt.outcome !== 'blunder') return null;
  if (!Number.isFinite(Date.parse(attempt.createdAt))) return null;
  if (isCatalogId(attempt.drillId) && !drillKeys.has(attempt.drillId)) {
    return {
      user_id: userId,
      client_id: attempt.clientId,
      puzzle_id: attempt.drillId,
      fen_key: null,
      move: attempt.move,
      outcome: attempt.outcome,
      created_at: attempt.createdAt,
    };
  }
  const key = drillKeys.get(attempt.drillId);
  if (!key) return null;
  return {
    user_id: userId,
    client_id: attempt.clientId,
    puzzle_id: null,
    fen_key: key,
    move: attempt.move,
    outcome: attempt.outcome,
    created_at: attempt.createdAt,
  };
}

function positionFromDrill(drill: DrillPosition): PositionWrite | null {
  if (!THEMES.includes(drill.theme)) return null;
  if (drill.sideToMove !== 'w' && drill.sideToMove !== 'b') return null;
  if (!SQUARE.test(drill.atRiskSquare)) return null;
  const key = fenKey(drill.fen);
  if (key.length < 15 || key.length > 120 || drill.fen.length < 15 || drill.fen.length > 200) return null;
  return {
    fen_key: key,
    fen: drill.fen,
    theme: drill.theme,
    side_to_move: drill.sideToMove,
    at_risk_square: drill.atRiskSquare,
    prompt: clip(drill.prompt, 200),
    solution: textList(drill.solution),
    acceptable: textList(drill.acceptable),
    traps: drill.traps,
    note: clip(drill.note, 500),
    expected_drop_cp: Math.trunc(drill.expectedDropCp),
  };
}

function drillFromUserRow(
  row: UserDrillRow,
  positions: Map<number, PositionRow>,
  puzzles: Map<string, PuzzleRow>,
): DrillPosition | null {
  if (row.puzzle_id) {
    const puzzle = puzzles.get(row.puzzle_id);
    if (!puzzle) return null;
    return drillFromParts(row.local_id, puzzle, row);
  }
  if (row.position_id == null) return null;
  const position = positions.get(row.position_id);
  if (!position) return null;
  return drillFromParts(row.local_id, position, row);
}

function drillFromParts(
  id: string,
  row: PositionRow | PuzzleRow,
  sourceRow: UserDrillRow,
): DrillPosition | null {
  const parsed = parseDrillList(
    [
      {
        id,
        fen: row.fen,
        sideToMove: row.side_to_move,
        theme: row.theme,
        atRiskSquare: row.at_risk_square,
        prompt: row.prompt,
        solution: row.solution,
        acceptable: row.acceptable,
        traps: row.traps,
        note: row.note,
        expectedDropCp: row.expected_drop_cp,
        source: sourceFromRow(sourceRow),
      },
    ],
    1,
  );
  return parsed[0] ?? null;
}

function reviewFromRow(
  row: ReviewRow,
  positions: Map<number, PositionRow>,
  localByPosition: Map<number, string>,
  puzzles: Map<string, PuzzleRow>,
  today = localDateKey(),
): { entry: ReviewEntry; meta: ReviewMeta } | null {
  const schedule = scheduleFromStored(Math.min(whole(row.interval_days), 3650), dateOrNull(row.due_on), today);
  const meta: ReviewMeta = {
    id: '',
    dueOn: schedule.dueOn,
    intervalDays: schedule.intervalDays,
    missHistory: cleanHistory(row.miss_history),
  };
  if (row.puzzle_id && isCatalogId(row.puzzle_id)) {
    meta.id = row.puzzle_id;
    return { entry: { id: row.puzzle_id, ...schedule }, meta };
  }
  if (row.position_id == null) return null;
  const position = positions.get(row.position_id);
  if (!position) return null;
  const id = localByPosition.get(row.position_id) ?? ownDrillId(position.fen);
  const drill = drillFromParts(id, position, {
    id: 0,
    user_id: row.user_id,
    local_id: id,
    puzzle_id: null,
    position_id: row.position_id,
    source_game_id: null,
    source_move: null,
    pasted: false,
    sort_index: 0,
  });
  if (!drill) return null;
  meta.id = drill.id;
  return { entry: { id: drill.id, ...schedule, drill }, meta };
}

function scheduleForWrite(entry: ReviewEntry, meta: ReviewMeta | undefined, today: string): ReviewSchedule {
  if (isDateKey(entry.dueOn) && Number.isFinite(entry.intervalDays)) return scheduleFromSaved(entry, today);
  if (meta?.dueOn && isCalendarDate(meta.dueOn) && meta.intervalDays >= 3) {
    return scheduleFromSaved({ saves: 0, dueOn: meta.dueOn, intervalDays: meta.intervalDays }, today);
  }
  return scheduleFromSaved(entry, today);
}

function attemptFromRow(row: RemoteRead['attempts'][number], localByPosition: Map<number, string>): SyncAttempt | null {
  if (row.outcome !== 'safe' && row.outcome !== 'blunder') return null;
  if (!isClientId(row.client_id) || !isMove(row.move)) return null;
  const drillId = row.puzzle_id ?? (row.position_id == null ? null : localByPosition.get(row.position_id) ?? null);
  if (!drillId) return null;
  return {
    clientId: row.client_id,
    drillId,
    move: row.move,
    outcome: row.outcome,
    createdAt: row.created_at,
  };
}

function cursorForAccount(account: LinkedAccountRow, games: RemoteRead['scannedGames']): ScanCursor | null {
  if (account.provider !== 'chesscom' && account.provider !== 'lichess') return null;
  const seen = games
    .filter((game) => game.provider === account.provider && isPublicGameId(game.game_id))
    .map((game) => game.game_id);
  const stored = asRecord(account.scan_cursor) ?? {};
  return cursorFromSaved({
    ...stored,
    site: account.provider,
    username: account.username,
    seen,
    resume: false,
  });
}

function pickAccount(rows: readonly LinkedAccountRow[]): LinkedAccountRow | null {
  const usable = rows.filter((row) => row.provider === 'chesscom' || row.provider === 'lichess');
  return usable.find((row) => asRecord(row.scan_cursor)) ?? usable[0] ?? null;
}

function cursorJson(cursor: ScanCursor): Record<string, unknown> {
  return {
    site: cursor.site,
    username: cursor.username,
    newestMs: whole(cursor.newestMs),
    doneArchives: cursor.doneArchives.filter((url) => url.startsWith('https://api.chess.com/pub/')).slice(0, 36),
    lichessUntil: cursor.lichessUntil,
    backfillDone: cursor.backfillDone === true,
    games: whole(cursor.games),
  };
}

function publicSource(source: DrillPosition['source']): { gameId: string; move?: string } | null {
  if (!source || !isPublicGameId(source.gameId)) return null;
  if (!source.move || !isMove(source.move)) return { gameId: source.gameId };
  return { gameId: source.gameId, move: source.move };
}

function sourceFromRow(row: UserDrillRow): DrillPosition['source'] | undefined {
  if (!row.source_game_id || !isPublicGameId(row.source_game_id)) return undefined;
  if (!row.source_move || !isMove(row.source_move)) return { gameId: row.source_game_id };
  return { gameId: row.source_game_id, move: row.source_move };
}

function providerForGameId(id: string): GameSite | null {
  if (id.startsWith('c:')) return 'chesscom';
  if (id.startsWith('l:')) return 'lichess';
  return null;
}

function phaseForRow(phase: ScanPhase): ProfileWrite['scan_phase'] {
  switch (phase) {
    case 'scanning':
    case 'paused':
      return 'paused';
    case 'done':
    case 'error':
    case 'idle':
      return phase;
    default: {
      const neverPhase: never = phase;
      return neverPhase;
    }
  }
}

function themeStats(value: unknown): ProfileWrite['theme_stats'] {
  const record = asRecord(value);
  if (!record) return {};
  const out: ProfileWrite['theme_stats'] = {};
  for (const theme of THEMES) {
    const tally = asRecord(record[theme]);
    if (!tally) continue;
    const attempts = whole(tally.attempts);
    const correct = Math.min(whole(tally.correct), attempts);
    if (attempts === 0 && correct === 0 && tally.attempts == null) continue;
    out[theme] = { attempts, correct };
  }
  return out;
}

function experience(value: unknown): Experience | null {
  if (value === 'new' || value === 'basics') return value;
  return null;
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 80 || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function textList(value: readonly string[]): string[] {
  return value.filter((item) => item.length > 0 && item.length <= 16);
}

function cleanHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 40 || item.includes('\n')) continue;
    out.push(item);
    if (out.length >= 40) break;
  }
  return out;
}

function dedupeAttempts(attempts: readonly SyncAttempt[]): SyncAttempt[] {
  const out: SyncAttempt[] = [];
  const seen = new Set<string>();
  for (const attempt of attempts) {
    if (seen.has(attempt.clientId)) continue;
    seen.add(attempt.clientId);
    out.push(attempt);
  }
  return out;
}

function dateOrNull(value: unknown): string | null {
  return typeof value === 'string' && isCalendarDate(value) ? value : null;
}

function isClientId(value: string): boolean {
  return value.length > 0 && value.length <= 80 && !value.includes('\n');
}

function isMove(value: string): boolean {
  return value.length > 0 && value.length <= 16 && !value.includes(' ') && !value.includes('\n');
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
