import { describe, expect, it, vi } from 'vitest';

vi.mock('@/src/data/supabase', () => ({
  getSupabase: () => null,
}));

import {
  createLeaderboardDb,
  leaderboardErrorMessage,
  loadLeaderboardPageWith,
  openStreakRunWith,
  publishStreakScore,
  publishStreakScoreWith,
  rankLeaderboard,
  saveLeaderboardName,
  saveLeaderboardNameWith,
  type LeaderboardDb,
  type LeaderboardQueryClient,
} from '@/src/data/leaderboard';

function db(partial: Partial<LeaderboardDb> = {}): LeaderboardDb {
  return {
    userId: async () => null,
    selectName: async () => null,
    upsertName: async () => ({ error: null }),
    weekBoard: async () => ({ rows: [], error: null }),
    allTimeBoard: async () => ({ rows: [], error: null }),
    startRun: async () => ({ error: null }),
    submitScore: async () => ({ error: null }),
    ...partial,
  };
}

describe('leaderboard names and scores', () => {
  it('keeps a guest off the board and skips a player who has not opted in', async () => {
    const submitScore = vi.fn(async () => ({ error: null }));
    const startRun = vi.fn(async () => ({ error: null }));
    const upsertName = vi.fn(async () => ({ error: null }));
    const guest = db({ submitScore, startRun, upsertName });

    await publishStreakScoreWith(guest, 4);
    await openStreakRunWith(guest);
    const guestSave = await saveLeaderboardNameWith(guest, 'Ada', true);
    expect(guestSave).toEqual({ ok: false, message: 'Sign in to post a score. Play stays open.' });
    expect(submitScore).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
    expect(upsertName).not.toHaveBeenCalled();

    const signedOut = db({
      userId: async () => 'user-1',
      selectName: async () => ({ name: 'Ada', optedIn: false }),
      submitScore,
    });
    await publishStreakScoreWith(signedOut, 4);
    await publishStreakScoreWith(signedOut, 0);
    await publishStreakScoreWith(signedOut, 101);
    expect(submitScore).not.toHaveBeenCalled();
  });

  it('posts a score only as a number after the player opts in', async () => {
    const submitScore = vi.fn(async () => ({ error: null }));
    const optedIn = db({
      userId: async () => 'user-1',
      selectName: async () => ({ name: 'Ada', optedIn: true }),
      submitScore,
    });
    await publishStreakScoreWith(optedIn, 6);
    expect(submitScore).toHaveBeenCalledTimes(1);
    expect(submitScore).toHaveBeenCalledWith(6);
    await publishStreakScore(4);
    expect(submitScore).toHaveBeenCalledTimes(1);
  });

  it('checks the name before writing and never sends an account address', async () => {
    const upsertName = vi.fn(async () => ({ error: null }));
    const store = db({ userId: async () => 'user-1', upsertName });
    expect(await saveLeaderboardNameWith(store, 'shit', true)).toEqual({
      ok: false,
      message: 'Choose a different name.',
    });
    expect(upsertName).not.toHaveBeenCalled();
    expect(await saveLeaderboardNameWith(store, '  Ada  ', false)).toEqual({ ok: true });
    expect(upsertName).toHaveBeenCalledWith('user-1', 'Ada', false);
    const payload = JSON.stringify(upsertName.mock.calls);
    expect(payload).not.toContain('@');
    expect(payload).not.toContain('secret');
    expect(await saveLeaderboardName('Ada', false)).toEqual({
      ok: false,
      message: 'This build has no leaderboard server. Your best stays on this device.',
    });
  });

  it('maps server failures without repeating the database text', () => {
    expect(leaderboardErrorMessage({ code: '23505', message: 'duplicate key value violates leaderboard_names_lower_key' })).toBe(
      'That name is taken.',
    );
    expect(leaderboardErrorMessage({ code: '42501', message: 'rate limit' })).toBe(
      'Too many scores this hour. Try again later.',
    );
    expect(leaderboardErrorMessage({ code: '42501', message: 'too fast' })).toBe('That run was too fast to save.');
    expect(leaderboardErrorMessage({ code: '23514', message: 'implausible score' })).toBe('That score cannot be saved.');
    expect(leaderboardErrorMessage({ message: 'not on the leaderboard' })).toBe(
      'Save a public name and turn the board on first.',
    );
    expect(leaderboardErrorMessage({ message: 'start a run first' })).toBe('Start a Streak run, then finish it.');
    expect(leaderboardErrorMessage({ message: 'run expired' })).toBe('That run took too long to save.');
    expect(leaderboardErrorMessage({ code: '42501', message: 'not authenticated' })).toBe(
      'Sign in to post a score. Play stays open.',
    );
    const leaked = leaderboardErrorMessage({ message: 'relation secret_table does not exist' });
    expect(leaked).toBe('Could not save that. Try again.');
    expect(leaked).not.toContain('secret_table');
  });

  it('shows twenty public rows and drops a name that looks like an address', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      display_name: `Player${index}`,
      score: 30 - index,
    }));
    rows.splice(1, 0, { display_name: 'secret@example.com', score: 99 });
    const ranked = rankLeaderboard(rows);
    expect(ranked).toHaveLength(20);
    expect(ranked[0]).toEqual({ displayName: 'Player0', score: 30 });
    expect(ranked.some((row) => row.displayName.includes('@'))).toBe(false);
    expect(rankLeaderboard([{ display_name: 'Ada', score: 1.5 }])).toEqual([]);
  });

  it('reads the public columns and writes the name without a session label', async () => {
    const calls: unknown[] = [];
    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
      },
      from(table: string) {
        return {
          select(columns: string) {
            calls.push({ op: 'select', table, columns });
            const data =
              table === 'leaderboard_names'
                ? { display_name: 'Ada', opted_in: true }
                : [
                    { display_name: 'Ada', score: 4 },
                    { display_name: 'secret@example.com', score: 9 },
                  ];
            const promise = Promise.resolve({ data, error: null });
            return {
              eq: () => ({ maybeSingle: () => promise }),
              then: promise.then.bind(promise),
            };
          },
          upsert(row: Record<string, unknown>, options: { onConflict: string }) {
            calls.push({ op: 'upsert', table, row, options });
            return Promise.resolve({ error: null });
          },
        };
      },
      rpc(fn: string, args?: Record<string, unknown>) {
        calls.push({ op: 'rpc', fn, args });
        return Promise.resolve({ error: null });
      },
    } as LeaderboardQueryClient;
    const store = createLeaderboardDb(client);
    const page = await loadLeaderboardPageWith(store);
    expect(page.week).toEqual([{ displayName: 'Ada', score: 4 }]);
    expect(page.allTime).toEqual([{ displayName: 'Ada', score: 4 }]);
    expect(page.name).toBe('Ada');
    expect(page.optedIn).toBe(true);
    expect(page.unavailable).toBe(false);
    await store.upsertName('user-1', 'Ada', false);
    await store.submitScore(4);
    await store.startRun();
    expect(calls).toContainEqual({ op: 'select', table: 'streak_leaderboard_week', columns: 'display_name, score' });
    expect(calls).toContainEqual({
      op: 'select',
      table: 'streak_leaderboard_all_time',
      columns: 'display_name, score',
    });
    expect(calls).toContainEqual({
      op: 'select',
      table: 'leaderboard_names',
      columns: 'display_name, opted_in',
    });
    expect(calls).toContainEqual({
      op: 'upsert',
      table: 'leaderboard_names',
      row: { user_id: 'user-1', display_name: 'Ada', opted_in: false },
      options: { onConflict: 'user_id' },
    });
    expect(calls).toContainEqual({ op: 'rpc', fn: 'submit_streak_score', args: { p_score: 4 } });
    expect(calls).toContainEqual({ op: 'rpc', fn: 'start_streak_run', args: undefined });
    expect(JSON.stringify(calls)).not.toContain('secret@example.com');
    expect(JSON.stringify(calls)).not.toContain('user_metadata');
  });
});
