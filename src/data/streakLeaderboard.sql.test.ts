import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DISPLAY_NAME_BLOCKLIST, DISPLAY_NAME_LEET_FROM, DISPLAY_NAME_LEET_TO } from '@/src/logic/displayName';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20261126233215_streak_leaderboard.sql'),
  'utf8',
);

function viewBody(name: string): string {
  const start = sql.indexOf(`create view public.${name}`);
  const rest = sql.slice(start);
  return rest.slice(0, rest.indexOf(';'));
}

describe('streak leaderboard migration', () => {
  it('locks scores to the signed-in player and lets the public read names and scores', () => {
    expect(sql).toContain('alter table public.leaderboard_names enable row level security;');
    expect(sql).toContain('alter table public.streak_scores enable row level security;');
    expect(sql).toContain('alter table private.streak_runs enable row level security;');
    expect(sql.toLowerCase()).not.toContain('force row level security');
    expect(sql).toContain('user_id = (select auth.uid())');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('references public.profiles (id) on delete cascade');
    expect(sql).toContain('grant select, insert on table public.streak_scores to authenticated;');
    expect(sql).toContain('grant select, insert, update on table public.leaderboard_names to authenticated;');
    expect(sql).not.toContain('grant select on table public.streak_scores to anon');
    expect(sql).not.toContain('grant select on table public.leaderboard_names to anon');
    expect(sql).not.toContain('for delete');
    expect(sql).toContain('create policy streak_runs_deny');
    expect(sql).toContain('using (false)');
    expect(sql).toContain('opted_in boolean not null default false');
    expect(sql).toContain('constraint streak_scores_range check (score between 1 and 100)');
    expect(sql).toContain('constraint leaderboard_names_ok check (private.display_name_ok(display_name))');
  });

  it('publishes display name and score through invoker views', () => {
    expect(sql.split('with (security_barrier = true, security_invoker = true)').length - 1).toBe(2);
    expect(sql.split('returns table (display_name text, score integer)').length - 1).toBe(2);
    for (const name of ['streak_leaderboard_week', 'streak_leaderboard_all_time']) {
      const body = viewBody(name);
      expect(body).toContain('select display_name, score');
      expect(body).not.toContain('user_id');
      expect(sql).toContain(`grant select on public.${name} to anon, authenticated;`);
    }
    expect(sql).toContain('grant execute on function private.streak_week_board() to anon, authenticated;');
    expect(sql).toContain('grant execute on function private.streak_all_time_board() to anon, authenticated;');
    expect(sql).toContain('grant usage on schema private to anon, authenticated;');
    expect(sql).not.toMatch(
      /grant execute on function private\.(open_streak_run|guard_streak_score|display_name_ok|name_blocked|streak_week_start|prepare_leaderboard_name)\([^)]*\) to anon/,
    );
  });

  it('checks the clock, the length, and the rate limit inside the database', () => {
    expect(sql).toContain('security invoker');
    expect(sql).toContain('security definer');
    expect(sql).toContain('revoke all on function public.submit_streak_score(integer) from public, anon;');
    expect(sql).toContain('grant execute on function public.submit_streak_score(integer) to authenticated;');
    expect(sql).toContain('grant execute on function public.start_streak_run() to authenticated;');
    expect(sql).toContain("insert into public.streak_scores (user_id, score)");
    expect(sql).toContain("raise exception 'implausible score'");
    expect(sql).toContain("raise exception 'too fast'");
    expect(sql).toContain("raise exception 'rate limit'");
    expect(sql).toContain("raise exception 'not on the leaderboard'");
    expect(sql).toContain("raise exception 'start a run first'");
    expect(sql).toContain("raise exception 'run expired'");
    expect(sql).toContain("raise exception 'not authenticated'");
    expect(sql).toContain("interval '1 second'");
    expect(sql).toContain("interval '6 hours'");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain("interval '2 seconds'");
    expect(sql).toContain('recent >= 20');
    expect(sql).toContain("date_trunc('week'");
    expect(sql).toContain("at time zone 'UTC'");
    expect(sql).toContain('limit 50');
    expect(sql).not.toContain('pg_catalog.coalesce');
  });

  it('uses the same name rules as the app and does not publish an account', () => {
    const literal = `array[${DISPLAY_NAME_BLOCKLIST.map((word) => `'${word}'`).join(', ')}]`;
    expect(sql).toContain(literal);
    expect(sql).toContain(
      `pg_catalog.translate(pg_catalog.lower(name), '${DISPLAY_NAME_LEET_FROM}', '${DISPLAY_NAME_LEET_TO}')`,
    );
    expect(sql).not.toContain('email');
    expect(sql).not.toContain('auth.users');
    expect(sql).not.toContain('service_role');
    expect(sql).not.toContain('user_metadata');
    expect(sql).not.toContain('create or replace function public.delete_my_account');
  });
});
