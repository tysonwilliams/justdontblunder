import { loadSupabase } from '@/src/data/supabaseLazy';
import { checkDisplayName } from '@/src/logic/displayName';
import { streakScoreInRange } from '@/src/logic/streak';

export const LEADERBOARD_LIMIT = 20;

export type LeaderboardRow = {
  displayName: string;
  score: number;
};

export type LeaderboardName = {
  name: string;
  optedIn: boolean;
};

export type LeaderboardPage = {
  configured: boolean;
  week: LeaderboardRow[];
  allTime: LeaderboardRow[];
  name: string;
  optedIn: boolean;
  unavailable: boolean;
};

export type SaveNameResult = { ok: true } | { ok: false; message: string };

export type LeaderboardFailure = {
  code?: string;
  message?: string;
  details?: string;
};

export type LeaderboardDb = {
  userId: () => Promise<string | null>;
  selectName: (userId: string) => Promise<LeaderboardName | null>;
  upsertName: (
    userId: string,
    name: string,
    optedIn: boolean,
  ) => Promise<{ error: LeaderboardFailure | null }>;
  weekBoard: () => Promise<{ rows: readonly Record<string, unknown>[]; error: LeaderboardFailure | null }>;
  allTimeBoard: () => Promise<{ rows: readonly Record<string, unknown>[]; error: LeaderboardFailure | null }>;
  startRun: () => Promise<{ error: LeaderboardFailure | null }>;
  submitScore: (score: number) => Promise<{ error: LeaderboardFailure | null }>;
};

type QueryResult = { data: unknown; error: LeaderboardFailure | null };

export type LeaderboardQueryClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<QueryResult>;
      };
      then: Promise<QueryResult>['then'];
    };
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: LeaderboardFailure | null }>;
  };
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: LeaderboardFailure | null }>;
};

const SIGN_IN = 'Sign in to post a score. Play stays open.';
const NO_SERVER = 'This build has no leaderboard server. Your best stays on this device.';
const TRY_AGAIN = 'Could not save that. Try again.';

export function leaderboardErrorMessage(error: LeaderboardFailure): string {
  const lower = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  if (error.code === '23505' || lower.includes('leaderboard_names_lower_key') || lower.includes('duplicate key')) {
    return 'That name is taken.';
  }
  if (lower.includes('too fast')) return 'That run was too fast to save.';
  if (lower.includes('implausible')) return 'That score cannot be saved.';
  if (lower.includes('rate limit')) return 'Too many scores this hour. Try again later.';
  if (lower.includes('not on the leaderboard')) return 'Save a public name and turn the board on first.';
  if (lower.includes('start a run first')) return 'Start a Streak run, then finish it.';
  if (lower.includes('run expired')) return 'That run took too long to save.';
  if (lower.includes('not authenticated')) return SIGN_IN;
  if (error.code === '23514' && lower.includes('leaderboard_names')) return 'Choose a different name.';
  return TRY_AGAIN;
}

export function rankLeaderboard(rows: readonly Record<string, unknown>[]): LeaderboardRow[] {
  const ranked: LeaderboardRow[] = [];
  for (const row of rows) {
    if (typeof row.display_name !== 'string' || row.display_name.includes('@')) continue;
    if (typeof row.score !== 'number' || !Number.isInteger(row.score)) continue;
    ranked.push({ displayName: row.display_name, score: row.score });
    if (ranked.length >= LEADERBOARD_LIMIT) break;
  }
  return ranked;
}

function emptyPage(configured: boolean, unavailable: boolean): LeaderboardPage {
  return { configured, week: [], allTime: [], name: '', optedIn: false, unavailable };
}

export async function loadLeaderboardPageWith(db: LeaderboardDb | null): Promise<LeaderboardPage> {
  if (!db) return emptyPage(false, false);
  const userId = await db.userId();
  const [week, allTime, saved] = await Promise.all([
    db.weekBoard(),
    db.allTimeBoard(),
    userId ? db.selectName(userId) : Promise.resolve(null),
  ]);
  return {
    configured: true,
    week: rankLeaderboard(week.rows),
    allTime: rankLeaderboard(allTime.rows),
    name: saved?.name ?? '',
    optedIn: saved?.optedIn ?? false,
    unavailable: week.error != null || allTime.error != null,
  };
}

export async function saveLeaderboardNameWith(
  db: LeaderboardDb | null,
  raw: string,
  optedIn: boolean,
): Promise<SaveNameResult> {
  const checked = checkDisplayName(raw);
  if (!checked.ok) return checked;
  if (!db) return { ok: false, message: NO_SERVER };
  const userId = await db.userId();
  if (!userId) return { ok: false, message: SIGN_IN };
  const saved = await db.upsertName(userId, checked.name, optedIn);
  if (saved.error) return { ok: false, message: leaderboardErrorMessage(saved.error) };
  return { ok: true };
}

export async function publishStreakScoreWith(db: LeaderboardDb | null, score: number): Promise<void> {
  if (!streakScoreInRange(score) || !db) return;
  const userId = await db.userId();
  if (!userId) return;
  const saved = await db.selectName(userId);
  if (!saved?.optedIn) return;
  await db.submitScore(score);
}

export async function openStreakRunWith(db: LeaderboardDb | null): Promise<void> {
  if (!db) return;
  const userId = await db.userId();
  if (!userId) return;
  await db.startRun();
}

function rowsFrom(result: QueryResult): { rows: readonly Record<string, unknown>[]; error: LeaderboardFailure | null } {
  const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
  return { rows, error: result.error };
}

function nameFrom(data: unknown): LeaderboardName | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as { display_name?: unknown; opted_in?: unknown };
  if (typeof row.display_name !== 'string') return null;
  return { name: row.display_name, optedIn: row.opted_in === true };
}

/** Publishable client only. The casts match the leaderboard queries, not a privileged key. */
export function createLeaderboardDb(client: LeaderboardQueryClient): LeaderboardDb {
  return {
    async userId() {
      const { data } = await client.auth.getSession();
      return data.session?.user.id ?? null;
    },
    async selectName(userId) {
      const { data, error } = await client
        .from('leaderboard_names')
        .select('display_name, opted_in')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) return null;
      return nameFrom(data);
    },
    async upsertName(userId, name, optedIn) {
      const { error } = await client.from('leaderboard_names').upsert(
        { user_id: userId, display_name: name, opted_in: optedIn },
        { onConflict: 'user_id' },
      );
      return { error };
    },
    async weekBoard() {
      return rowsFrom(await client.from('streak_leaderboard_week').select('display_name, score'));
    },
    async allTimeBoard() {
      return rowsFrom(await client.from('streak_leaderboard_all_time').select('display_name, score'));
    },
    async startRun() {
      return client.rpc('start_streak_run');
    },
    async submitScore(score) {
      return client.rpc('submit_streak_score', { p_score: score });
    },
  };
}

async function leaderboardDb(): Promise<LeaderboardDb | null> {
  const client = await loadSupabase();
  if (!client) return null;
  return createLeaderboardDb(client as unknown as LeaderboardQueryClient);
}

export async function loadLeaderboardPage(): Promise<LeaderboardPage> {
  try {
    return await loadLeaderboardPageWith(await leaderboardDb());
  } catch {
    return emptyPage(true, true);
  }
}

export async function saveLeaderboardName(raw: string, optedIn: boolean): Promise<SaveNameResult> {
  try {
    return await saveLeaderboardNameWith(await leaderboardDb(), raw, optedIn);
  } catch {
    return { ok: false, message: TRY_AGAIN };
  }
}

export async function publishStreakScore(score: number): Promise<void> {
  try {
    await publishStreakScoreWith(await leaderboardDb(), score);
  } catch {
    return;
  }
}

export async function openStreakRun(): Promise<void> {
  try {
    await openStreakRunWith(await leaderboardDb());
  } catch {
    return;
  }
}
