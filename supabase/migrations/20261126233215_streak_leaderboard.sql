-- Streak leaderboard.
-- Apply by hand after review. Do not supabase db push or config push from the app workflow.
-- The hosted project does not have this migration until that review applies it.
--
-- A player can insert only their own scores. The public views return a display
-- name and a score, and only for names that opted in. opted_in defaults to
-- false, so a new row is not on the board. The views do not return an account id.
--
-- private.streak_runs holds one open clock. It is not granted to the API.
-- The insert trigger overwrites the week and the timestamp from the database
-- clock. It rejects a score outside 1 to 100, a score faster than one second
-- per save, a clock older than six hours, a player who is not opted in, and
-- more than 20 scores in an hour. The clock stops a pasted score that is
-- longer than the time since the run started. It does not replay the moves.
--
-- Week boundaries are Monday 00:00 UTC.
--   2026-11-26 23:59 UTC -> 2026-11-23
--   2026-11-23 00:00 UTC -> 2026-11-23
--   2026-11-22 23:59 UTC -> 2026-11-16
--   2026-01-01 12:00 UTC -> 2025-12-29

create or replace function private.streak_week_start(ts timestamptz)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (pg_catalog.date_trunc('week', ts at time zone 'UTC'))::date;
$$;

revoke all on function private.streak_week_start(timestamptz) from public, anon, authenticated;

-- Same list and leet fold as src/logic/displayName.ts.
create or replace function private.name_blocked(folded text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(array['asshole', 'bitch', 'cock', 'cunt', 'dick', 'faggot', 'fck', 'fock', 'fuck', 'fuk', 'fvck', 'nazi', 'nigga', 'nigger', 'phuck', 'piss', 'pussy', 'retard', 'shit', 'slut', 'twat', 'whore']) as word
    cross join unnest(pg_catalog.string_to_array(folded, ' ')) as token
    where token = word
      or (
        pg_catalog.char_length(word) >= 4
        and (
          pg_catalog.starts_with(token, word)
          or pg_catalog.right(token, pg_catalog.char_length(word)) = word
        )
      )
      or pg_catalog.replace(folded, ' ', '') = word
      or (
        pg_catalog.char_length(word) >= 4
        and (
          pg_catalog.starts_with(pg_catalog.replace(folded, ' ', ''), word)
          or pg_catalog.right(pg_catalog.replace(folded, ' ', ''), pg_catalog.char_length(word)) = word
        )
      )
  );
$$;

revoke all on function private.name_blocked(text) from public, anon, authenticated;
grant execute on function private.name_blocked(text) to authenticated;

create or replace function private.display_name_ok(name text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select name is not null
    and pg_catalog.char_length(name) between 2 and 20
    and name ~ '^[A-Za-z0-9]+( [A-Za-z0-9]+)*$'
    and not private.name_blocked(pg_catalog.translate(pg_catalog.lower(name), '013457@$!', 'oieastasi'));
$$;

revoke all on function private.display_name_ok(text) from public, anon, authenticated;
grant execute on function private.display_name_ok(text) to authenticated;

create or replace function private.prepare_leaderboard_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := pg_catalog.btrim(new.display_name);
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.prepare_leaderboard_name() from public, anon, authenticated;

create table public.leaderboard_names (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  opted_in boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint leaderboard_names_ok check (private.display_name_ok(display_name))
);

comment on table public.leaderboard_names is
  'Public Streak name. opted_in defaults to false, so a new row is not on the board.';

create unique index leaderboard_names_lower_key
  on public.leaderboard_names (lower(display_name));

create trigger leaderboard_names_prepare
  before insert or update on public.leaderboard_names
  for each row execute function private.prepare_leaderboard_name();

create table public.streak_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null,
  week_start date not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint streak_scores_range check (score between 1 and 100)
);

comment on table public.streak_scores is
  'Append-only Streak scores. The insert trigger sets the week from the database clock.';

create index streak_scores_user_created_idx
  on public.streak_scores (user_id, created_at desc);

create index streak_scores_week_idx
  on public.streak_scores (week_start, user_id);

create table private.streak_runs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  started_at timestamptz not null
);

comment on table private.streak_runs is
  'Open Streak clock. Not granted to the API.';

alter table public.leaderboard_names enable row level security;
alter table public.streak_scores enable row level security;
alter table private.streak_runs enable row level security;

revoke all on table public.leaderboard_names from public, anon, authenticated;
revoke all on table public.streak_scores from public, anon, authenticated;
revoke all on table private.streak_runs from public, anon, authenticated;

grant select, insert, update on table public.leaderboard_names to authenticated;
grant select, insert on table public.streak_scores to authenticated;

revoke all on sequence public.streak_scores_id_seq from public, anon, authenticated;
grant usage, select on sequence public.streak_scores_id_seq to authenticated;

create policy leaderboard_names_select_own
  on public.leaderboard_names
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy leaderboard_names_insert_own
  on public.leaderboard_names
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy leaderboard_names_update_own
  on public.leaderboard_names
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy streak_scores_select_own
  on public.streak_scores
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy streak_scores_insert_own
  on public.streak_scores
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy streak_runs_deny
  on private.streak_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Starts or refreshes the signed-in player's clock.
-- A clock from the last two seconds is left as it is, so a double mount does
-- not restart it. An older clock is replaced, so a stale clock cannot post a long score.
create or replace function private.open_streak_run()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into private.streak_runs (user_id, started_at)
  values (uid, pg_catalog.now())
  on conflict (user_id) do update
    set started_at = excluded.started_at
    where private.streak_runs.started_at <= pg_catalog.now() - interval '2 seconds';
end;
$$;

revoke all on function private.open_streak_run() from public, anon, authenticated;
grant execute on function private.open_streak_run() to authenticated;

create or replace function private.guard_streak_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  started timestamptz;
  elapsed interval;
  recent bigint;
  opted boolean;
  named text;
begin
  uid := (select auth.uid());
  if uid is null or new.user_id is distinct from uid then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if new.score is null or new.score < 1 or new.score > 100 then
    raise exception 'implausible score' using errcode = '23514';
  end if;

  select display_name, opted_in
    into named, opted
  from public.leaderboard_names
  where user_id = uid;

  if opted is distinct from true or named is null or not private.display_name_ok(named) then
    raise exception 'not on the leaderboard' using errcode = '23514';
  end if;

  select started_at
    into started
  from private.streak_runs
  where user_id = uid
  for update;

  if started is null then
    raise exception 'start a run first' using errcode = '42501';
  end if;

  elapsed := pg_catalog.now() - started;
  if elapsed < new.score * interval '1 second' then
    raise exception 'too fast' using errcode = '42501';
  end if;
  if elapsed >= interval '6 hours' then
    raise exception 'run expired' using errcode = '42501';
  end if;

  select count(*)
    into recent
  from public.streak_scores
  where user_id = uid
    and created_at >= pg_catalog.now() - interval '1 hour';

  if recent >= 20 then
    raise exception 'rate limit' using errcode = '42501';
  end if;

  new.week_start := private.streak_week_start(pg_catalog.now());
  new.created_at := pg_catalog.now();
  delete from private.streak_runs where user_id = uid;
  return new;
end;
$$;

revoke all on function private.guard_streak_score() from public, anon, authenticated;

create trigger streak_scores_guard
  before insert on public.streak_scores
  for each row execute function private.guard_streak_score();

-- No auth.uid() check: this is a public projection of opted-in names and scores.
-- The function is the owner so it can read past row security. It returns two columns.
create or replace function private.streak_week_board()
returns table (display_name text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.display_name, max(s.score) as score
  from public.streak_scores s
  join public.leaderboard_names n on n.user_id = s.user_id
  where n.opted_in
    and private.display_name_ok(n.display_name)
    and s.week_start = private.streak_week_start(pg_catalog.now())
  group by n.user_id, n.display_name
  order by max(s.score) desc, n.display_name asc
  limit 50;
$$;

create or replace function private.streak_all_time_board()
returns table (display_name text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.display_name, max(s.score) as score
  from public.streak_scores s
  join public.leaderboard_names n on n.user_id = s.user_id
  where n.opted_in
    and private.display_name_ok(n.display_name)
  group by n.user_id, n.display_name
  order by max(s.score) desc, n.display_name asc
  limit 50;
$$;

revoke all on function private.streak_week_board() from public, anon, authenticated;
revoke all on function private.streak_all_time_board() from public, anon, authenticated;
grant execute on function private.streak_week_board() to anon, authenticated;
grant execute on function private.streak_all_time_board() to anon, authenticated;

grant usage on schema private to anon, authenticated;

create view public.streak_leaderboard_week
with (security_barrier = true, security_invoker = true)
as
select display_name, score
from private.streak_week_board();

create view public.streak_leaderboard_all_time
with (security_barrier = true, security_invoker = true)
as
select display_name, score
from private.streak_all_time_board();

revoke all on public.streak_leaderboard_week from public, anon, authenticated;
revoke all on public.streak_leaderboard_all_time from public, anon, authenticated;
grant select on public.streak_leaderboard_week to anon, authenticated;
grant select on public.streak_leaderboard_all_time to anon, authenticated;

comment on view public.streak_leaderboard_week is
  'This week, Monday 00:00 UTC. Display name and score only.';

comment on view public.streak_leaderboard_all_time is
  'All-time best. Display name and score only.';

create or replace function public.start_streak_run()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.open_streak_run();
end;
$$;

create or replace function public.submit_streak_score(p_score integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := (select auth.uid());
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.streak_scores (user_id, score)
  values (uid, p_score);
end;
$$;

revoke all on function public.start_streak_run() from public, anon;
revoke all on function public.submit_streak_score(integer) from public, anon;
grant execute on function public.start_streak_run() to authenticated;
grant execute on function public.submit_streak_score(integer) to authenticated;

comment on function public.start_streak_run() is
  'Starts or refreshes the signed-in player Streak clock.';

comment on function public.submit_streak_score(integer) is
  'Inserts the signed-in player Streak score. The row trigger checks the open run, the opt-in, the length, and the rate limit.';
