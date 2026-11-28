import { rowsFromSnapshot, snapshotFromRows } from '@/src/data/sync/map';
import { mergeSnapshots } from '@/src/data/sync/merge';
import {
  SyncError,
  type AttemptRow,
  type LinkedAccountRow,
  type PositionRow,
  type ProfileRow,
  type ProgressRepo,
  type PuzzleRow,
  type RemoteRead,
  type RemoteRows,
  type ReviewRow,
  type ScannedGameRow,
  type StreakRow,
  type SyncClient,
  type SyncQuery,
  type UserDrillRow,
} from '@/src/data/sync/types';
import type { PersistedProgress } from '@/src/store/progressMigrate';

const PAGE = 1000;

const PROFILE =
  'id, timezone, experience, welcome_skipped, drills_prompt_skipped, missed_date, daily_streak, last_drill_date, drills_completed, drills_correct, blunders_avoided, blunders_made, practice_moves, theme_stats, record_streak, best_puzzle_streak, xp, completed_lessons, scan_phase, scan_found, scan_games, scan_message';
const LINKED = 'id, user_id, provider, username, verified, last_scanned_at, scan_cursor';
const SCANNED = 'id, user_id, provider, game_id';
const POSITION =
  'id, fen_key, fen, theme, side_to_move, at_risk_square, prompt, solution, acceptable, traps, note, expected_drop_cp';
const PUZZLE =
  'id, fen, theme, side_to_move, at_risk_square, prompt, solution, acceptable, traps, note, expected_drop_cp';
const USER_DRILL =
  'id, user_id, local_id, puzzle_id, position_id, source_game_id, source_move, pasted, sort_index';
const REVIEW =
  'id, user_id, user_drill_id, puzzle_id, position_id, saves, miss_history, due_on, interval_days, pile_index';
const ATTEMPT = 'id, user_id, client_id, puzzle_id, position_id, move, outcome, created_at';
const STREAK = 'id, user_id, local_date';

export function createSupabaseProgressRepo(
  client: SyncClient,
  userId: string,
  local: {
    load: () => PersistedProgress | Promise<PersistedProgress>;
    save: (progress: PersistedProgress) => void | Promise<void>;
  },
  now: () => string = () => new Date().toISOString(),
): ProgressRepo {
  return {
    async load() {
      return local.load();
    },
    async save(progress) {
      await local.save(progress);
    },
    async pull() {
      return snapshotFromRows(await readRemote(client, userId));
    },
    async push(snapshot) {
      await writeRemote(client, userId, rowsFromSnapshot(snapshot, userId));
    },
    async mergeOnSignIn(guest) {
      const remote = await this.pull();
      const merged = remote ? mergeSnapshots(guest, remote, now()) : guest;
      await local.save(merged.progress);
      await this.push(merged);
      return merged.progress;
    },
  };
}

async function readRemote(client: SyncClient, userId: string): Promise<RemoteRead> {
  const [profiles, linkedAccounts, scannedGames, userDrills, reviewEntries, attempts, streaks] = await Promise.all([
    selectEq<ProfileRow>(client, 'profiles', PROFILE, 'id', userId),
    selectEq<LinkedAccountRow>(client, 'linked_accounts', LINKED, 'user_id', userId),
    selectEq<ScannedGameRow>(client, 'scanned_games', SCANNED, 'user_id', userId),
    selectEq<UserDrillRow>(client, 'user_drills', USER_DRILL, 'user_id', userId),
    selectEq<ReviewRow>(client, 'review_entries', REVIEW, 'user_id', userId),
    selectEq<AttemptRow>(client, 'attempts', ATTEMPT, 'user_id', userId),
    selectEq<StreakRow>(client, 'daily_streaks', STREAK, 'user_id', userId),
  ]);
  const profile = profiles[0] ?? null;
  const positionIds = unique([
    ...userDrills.map((row) => row.position_id),
    ...reviewEntries.map((row) => row.position_id),
    ...attempts.map((row) => row.position_id),
  ]);
  const puzzleIds = unique([
    ...userDrills.map((row) => row.puzzle_id),
    ...reviewEntries.map((row) => row.puzzle_id),
    ...attempts.map((row) => row.puzzle_id),
  ]);
  const [positions, puzzles] = await Promise.all([
    selectIn<PositionRow>(client, 'positions', POSITION, 'id', positionIds),
    selectIn<PuzzleRow>(client, 'puzzles', PUZZLE, 'id', puzzleIds),
  ]);
  return {
    profile,
    linkedAccounts,
    scannedGames,
    positions,
    puzzles,
    userDrills,
    reviewEntries,
    attempts,
    streakDates: streaks.map((row) => row.local_date).filter((date) => typeof date === 'string'),
  };
}

async function writeRemote(client: SyncClient, userId: string, rows: RemoteRows): Promise<void> {
  await upsert(client, 'profiles', [{ ...rows.profile, id: userId }], 'id');
  if (rows.linkedAccounts.length > 0) {
    await upsert(
      client,
      'linked_accounts',
      rows.linkedAccounts.map((row) => defined({ ...row, user_id: userId })),
      'user_id,provider',
    );
  }
  if (rows.positions.length > 0) {
    await upsert(client, 'positions', rows.positions, 'fen_key', true);
  }
  const positionRows = await selectIn<PositionRow>(
    client,
    'positions',
    'id, fen_key',
    'fen_key',
    rows.positions.map((row) => row.fen_key),
  );
  const positionId = new Map(
    positionRows.flatMap((row) => {
      const id = num(row.id);
      return id == null ? [] : ([[row.fen_key, id]] as const);
    }),
  );
  const puzzleIds = unique([
    ...rows.userDrills.map((row) => row.puzzle_id),
    ...rows.reviewEntries.map((row) => row.puzzle_id),
    ...rows.attempts.map((row) => row.puzzle_id),
  ]);
  const knownPuzzles = new Set(
    (await selectIn<PuzzleRow>(client, 'puzzles', 'id', 'id', puzzleIds)).map((row) => row.id),
  );

  const drillRows = rows.userDrills.flatMap((row) => {
    if (row.puzzle_id) {
      if (!knownPuzzles.has(row.puzzle_id)) return [];
      return [drillPayload(row, userId, null)];
    }
    const found = row.fen_key ? positionId.get(row.fen_key) : undefined;
    if (found == null) return [];
    return [drillPayload(row, userId, found)];
  });
  if (drillRows.length > 0) await upsert(client, 'user_drills', drillRows, 'user_id,local_id');
  const savedDrills = await selectEq<UserDrillRow>(client, 'user_drills', 'id, local_id', 'user_id', userId);
  const drillId = new Map(
    savedDrills.flatMap((row) => {
      const id = num(row.id);
      return id == null ? [] : ([[row.local_id, id]] as const);
    }),
  );
  const keepDrills = new Set(rows.userDrills.map((row) => row.local_id));
  await deleteIds(
    client,
    'user_drills',
    userId,
    savedDrills.flatMap((row) => {
      const id = num(row.id);
      return id != null && !keepDrills.has(row.local_id) ? [id] : [];
    }),
  );

  if (rows.scannedGames.length > 0) {
    await upsert(
      client,
      'scanned_games',
      rows.scannedGames.map((row) => ({ ...row, user_id: userId })),
      'user_id,provider,game_id',
      true,
    );
  }
  if (rows.scannedProvider) {
    const keep = new Set(
      rows.scannedGames.filter((row) => row.provider === rows.scannedProvider).map((row) => row.game_id),
    );
    const existing = await selectEq<ScannedGameRow>(client, 'scanned_games', 'id, provider, game_id', 'user_id', userId);
    await deleteIds(
      client,
      'scanned_games',
      userId,
      existing.flatMap((row) => {
        const id = num(row.id);
        return id != null && row.provider === rows.scannedProvider && !keep.has(row.game_id) ? [id] : [];
      }),
    );
  }

  if (rows.streakDates.length > 0) {
    await upsert(
      client,
      'daily_streaks',
      rows.streakDates.map((local_date) => ({ user_id: userId, local_date })),
      'user_id,local_date',
      true,
    );
  }

  await writeReviews(client, userId, rows, positionId, drillId, knownPuzzles);
  await writeAttempts(client, userId, rows, positionId, knownPuzzles);
}

function reviewMatches(existing: ReviewRow, payload: {
  user_drill_id: number | null;
  saves: number;
  miss_history: readonly string[];
  due_on: string | null;
  interval_days: number;
  pile_index: number;
}): boolean {
  if ((existing.user_drill_id ?? null) !== payload.user_drill_id) return false;
  if (existing.saves !== payload.saves) return false;
  if ((existing.due_on ?? null) !== payload.due_on) return false;
  if (existing.interval_days !== payload.interval_days) return false;
  if (existing.pile_index !== payload.pile_index) return false;
  const prev = Array.isArray(existing.miss_history) ? existing.miss_history : [];
  if (prev.length !== payload.miss_history.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== payload.miss_history[i]) return false;
  }
  return true;
}

async function writeReviews(
  client: SyncClient,
  userId: string,
  rows: RemoteRows,
  positionId: Map<string, number>,
  drillId: Map<string, number>,
  knownPuzzles: Set<string>,
): Promise<void> {
  const existing = await selectEq<ReviewRow>(client, 'review_entries', REVIEW, 'user_id', userId);
  const byPuzzle = new Map(existing.filter((row) => row.puzzle_id).map((row) => [row.puzzle_id, row]));
  const byPosition = new Map(existing.filter((row) => row.position_id != null).map((row) => [row.position_id, row]));
  const keep = new Set<number>();
  const toUpdate: { id: number; payload: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  for (const row of rows.reviewEntries) {
    const position_id = row.fen_key ? (positionId.get(row.fen_key) ?? null) : null;
    if (row.puzzle_id && !knownPuzzles.has(row.puzzle_id)) {
      const hidden = byPuzzle.get(row.puzzle_id);
      const hiddenId = hidden ? num(hidden.id) : null;
      if (hiddenId != null) keep.add(hiddenId);
      continue;
    }
    if (row.fen_key && position_id == null) continue;
    const payload = {
      user_id: userId,
      user_drill_id: row.local_id ? (drillId.get(row.local_id) ?? null) : null,
      puzzle_id: row.puzzle_id,
      position_id,
      saves: row.saves,
      miss_history: row.miss_history,
      due_on: row.due_on,
      interval_days: row.interval_days,
      pile_index: row.pile_index,
    };
    const match = row.puzzle_id ? byPuzzle.get(row.puzzle_id) : position_id == null ? undefined : byPosition.get(position_id);
    const matchId = match ? num(match.id) : null;
    if (match && matchId != null) {
      keep.add(matchId);
      if (!reviewMatches(match, payload)) {
        toUpdate.push({ id: matchId, payload });
      }
    } else {
      toInsert.push(payload);
    }
  }
  for (const group of chunks(toUpdate, 10)) {
    await Promise.all(
      group.map((item) =>
        run(client.from('review_entries').update(item.payload).eq('id', item.id).eq('user_id', userId)),
      ),
    );
  }
  for (const group of chunks(toInsert, 100)) {
    const inserted = await rowsOf(client.from('review_entries').insert(group).select('id'));
    for (const row of inserted) {
      const id = num(row.id);
      if (id != null) keep.add(id);
    }
  }
  await deleteIds(
    client,
    'review_entries',
    userId,
    existing.flatMap((row) => {
      const id = num(row.id);
      return id != null && !keep.has(id) ? [id] : [];
    }),
  );
}

async function writeAttempts(
  client: SyncClient,
  userId: string,
  rows: RemoteRows,
  positionId: Map<string, number>,
  knownPuzzles: Set<string>,
): Promise<void> {
  const payload = rows.attempts.flatMap((row) => {
    if (row.puzzle_id) {
      if (!knownPuzzles.has(row.puzzle_id)) return [];
      return [attemptPayload(row, userId, null)];
    }
    const found = row.fen_key ? positionId.get(row.fen_key) : undefined;
    if (found == null) return [];
    return [attemptPayload(row, userId, found)];
  });
  if (payload.length === 0) return;
  await upsert(client, 'attempts', payload, 'user_id,client_id', true);
}

async function selectEq<T>(
  client: SyncClient,
  table: string,
  columns: string,
  column: string,
  value: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= PAGE * 100; from += PAGE) {
    const batch = await rowsOf(
      client.from(table).select(columns).eq(column, value).order('id', { ascending: true }).range(from, from + PAGE - 1),
    );
    rows.push(...(batch as T[]));
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function selectIn<T>(
  client: SyncClient,
  table: string,
  columns: string,
  column: string,
  values: readonly (string | number | null)[],
): Promise<T[]> {
  const ids = values.filter((value): value is string | number => value != null);
  const rows: T[] = [];
  for (const group of chunks(ids, 100)) {
    const batch = await rowsOf(
      client.from(table).select(columns).in(column, group).order('id', { ascending: true }).range(0, PAGE - 1),
    );
    rows.push(...(batch as T[]));
  }
  return rows;
}

async function upsert(
  client: SyncClient,
  table: string,
  rows: readonly Record<string, unknown>[],
  onConflict: string,
  ignoreDuplicates = false,
): Promise<void> {
  for (const group of chunks(rows, 200)) {
    await run(client.from(table).upsert(group, { onConflict, ignoreDuplicates }));
  }
}

async function deleteIds(client: SyncClient, table: string, userId: string, ids: readonly number[]): Promise<void> {
  for (const group of chunks(ids, 100)) {
    await run(client.from(table).delete().in('id', group).eq('user_id', userId));
  }
}

async function run(query: SyncQuery): Promise<void> {
  await rowsOf(query);
}

async function rowsOf(query: SyncQuery): Promise<Record<string, unknown>[]> {
  const result = await query;
  if (result.error) throw new SyncError(result.error.message);
  if (Array.isArray(result.data)) return result.data.filter(isRecord);
  if (isRecord(result.data)) return [result.data];
  return [];
}

function drillPayload(
  row: RemoteRows['userDrills'][number],
  userId: string,
  positionId: number | null,
): Record<string, unknown> {
  return {
    user_id: userId,
    local_id: row.local_id,
    puzzle_id: row.puzzle_id,
    position_id: positionId,
    source_game_id: row.source_game_id,
    source_move: row.source_move,
    pasted: row.pasted,
    sort_index: row.sort_index,
  };
}

function attemptPayload(
  row: RemoteRows['attempts'][number],
  userId: string,
  positionId: number | null,
): Record<string, unknown> {
  return {
    user_id: userId,
    client_id: row.client_id,
    puzzle_id: row.puzzle_id,
    position_id: positionId,
    move: row.move,
    outcome: row.outcome,
    created_at: row.created_at,
  };
}

function defined<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function unique(values: readonly (string | number | null | undefined)[]): (string | number)[] {
  const out: (string | number)[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (value == null) continue;
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
