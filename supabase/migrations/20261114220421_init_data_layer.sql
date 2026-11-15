-- Just Don't Blunder data layer.
-- Apply with the Supabase CLI after review. Do not run this by hand against a
-- plain Postgres: it expects auth.users and the anon / authenticated roles.
--
-- Scans stay on the device. These tables store results (game ids, positions,
-- progress). There is no PGN column and no Edge Function.

create schema if not exists private;

revoke all on schema private from public;

comment on schema private is
  'Not exposed in the Data API. Security-definer helpers live here.';

-- A public game id from Chess.com or Lichess. Rejects PGN tags, movetext, and
-- the fallback ids this app uses when a site did not send a real id.
create or replace function private.is_public_game_id(id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select id is not null
    and char_length(id) between 1 and 180
    and position(chr(10) in id) = 0
    and position(chr(13) in id) = 0
    and id !~ '\[[A-Za-z]'
    and id !~ '[0-9]+\.'
    and id !~ '^c:[0-9]+:'
    and id !~ '^l:[0-9]+:'
    and id !~ '^p:'
$$;

revoke all on function private.is_public_game_id(text) from public;
grant execute on function private.is_public_game_id(text) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

-- Chess.com usernames are never treated as verified.
create or replace function private.force_chesscom_unverified()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider = 'chesscom' then
    new.verified := false;
  end if;
  return new;
end;
$$;

revoke all on function private.force_chesscom_unverified() from public;

-- Drops the caller's sessions, then the auth user. Owned rows cascade.
-- A security-definer body stays in private. public.delete_my_account is the RPC.
create or replace function private.delete_auth_user()
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
    raise exception 'not authenticated';
  end if;
  delete from auth.sessions where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function private.delete_auth_user() from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  experience text,
  welcome_skipped boolean not null default false,
  drills_prompt_skipped boolean not null default false,
  missed_date date,
  daily_streak integer not null default 0,
  last_drill_date date,
  drills_completed integer not null default 0,
  drills_correct integer not null default 0,
  blunders_avoided integer not null default 0,
  blunders_made integer not null default 0,
  practice_moves integer not null default 0,
  theme_stats jsonb not null default '{}'::jsonb,
  record_streak integer not null default 0,
  best_puzzle_streak integer not null default 0,
  xp integer not null default 0,
  completed_lessons text[] not null default '{}',
  scan_phase text not null default 'idle',
  scan_found integer not null default 0,
  scan_games integer not null default 0,
  scan_message text not null default '',
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  ),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 64),
  constraint profiles_experience_check check (
    experience is null or experience in ('new', 'basics')
  ),
  constraint profiles_daily_streak_nonnegative check (daily_streak >= 0),
  constraint profiles_drills_completed_nonnegative check (drills_completed >= 0),
  constraint profiles_drills_correct_nonnegative check (drills_correct >= 0),
  constraint profiles_blunders_avoided_nonnegative check (blunders_avoided >= 0),
  constraint profiles_blunders_made_nonnegative check (blunders_made >= 0),
  constraint profiles_practice_moves_nonnegative check (practice_moves >= 0),
  constraint profiles_record_streak_nonnegative check (record_streak >= 0),
  constraint profiles_best_puzzle_streak_nonnegative check (best_puzzle_streak >= 0),
  constraint profiles_xp_nonnegative check (xp >= 0),
  constraint profiles_scan_phase_check check (
    scan_phase in ('idle', 'paused', 'done', 'error')
  ),
  constraint profiles_scan_found_nonnegative check (scan_found >= 0),
  constraint profiles_scan_games_nonnegative check (scan_games >= 0),
  constraint profiles_scan_message_length check (char_length(scan_message) <= 280),
  constraint profiles_theme_stats_object check (jsonb_typeof(theme_stats) = 'object')
);

comment on table public.profiles is
  'One row per auth user. Training counters, preferences, and the scan summary live here.';

comment on column public.profiles.timezone is
  'IANA zone of the device that last wrote local dates.';

create table public.linked_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  username text not null,
  verified boolean not null default false,
  last_scanned_at timestamptz,
  scan_cursor jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint linked_accounts_user_provider_key unique (user_id, provider),
  constraint linked_accounts_provider_check check (provider in ('chesscom', 'lichess')),
  constraint linked_accounts_username_check check (username ~ '^[A-Za-z0-9_-]{2,25}$'),
  constraint linked_accounts_chesscom_unverified check (
    provider <> 'chesscom' or verified = false
  ),
  constraint linked_accounts_scan_cursor_object check (
    scan_cursor is null or jsonb_typeof(scan_cursor) = 'object'
  )
);

comment on table public.linked_accounts is
  'Public Chess.com or Lichess username. Chess.com verified stays false.';

comment on column public.linked_accounts.verified is
  'Always false for chesscom. The check and private.force_chesscom_unverified both enforce it.';

comment on column public.linked_accounts.scan_cursor is
  'Resume fields for a client scan. Seen game ids live in scanned_games, not here, and this object has no PGN.';

create table public.scanned_games (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  game_id text not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint scanned_games_user_provider_game_key unique (user_id, provider, game_id),
  constraint scanned_games_provider_check check (provider in ('chesscom', 'lichess')),
  constraint scanned_games_game_id_public check (private.is_public_game_id(game_id))
);

comment on table public.scanned_games is
  'Game ids already read by a client scan. Ids only: no PGN and no movetext.';

create table public.puzzles (
  id text primary key,
  fen text not null,
  theme text not null,
  side_to_move text not null,
  traps jsonb not null default '[]'::jsonb,
  source text not null,
  license text not null,
  at_risk_square text not null,
  prompt text not null,
  solution jsonb not null,
  acceptable jsonb not null,
  note text not null,
  expected_drop_cp integer not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint puzzles_id_length check (char_length(id) between 1 and 64),
  constraint puzzles_theme_check check (
    theme in ('hanging', 'fork', 'pin', 'back_rank', 'missed_mate')
  ),
  constraint puzzles_side_check check (side_to_move in ('w', 'b')),
  constraint puzzles_square_check check (at_risk_square ~ '^[a-h][1-8]$'),
  constraint puzzles_traps_array check (jsonb_typeof(traps) = 'array'),
  constraint puzzles_solution_array check (jsonb_typeof(solution) = 'array'),
  constraint puzzles_acceptable_array check (jsonb_typeof(acceptable) = 'array'),
  constraint puzzles_source_length check (char_length(source) between 1 and 80),
  constraint puzzles_license_length check (char_length(license) between 1 and 80),
  constraint puzzles_fen_length check (char_length(fen) between 15 and 200),
  constraint puzzles_prompt_length check (char_length(prompt) between 1 and 200),
  constraint puzzles_note_length check (char_length(note) between 1 and 500)
);

comment on table public.puzzles is
  'Shared starter bank. Anonymous and signed-in users may read. Clients cannot write.';

create table public.positions (
  id bigint generated always as identity primary key,
  fen_key text not null,
  fen text not null,
  theme text not null,
  side_to_move text not null,
  at_risk_square text not null,
  prompt text not null,
  solution jsonb not null,
  acceptable jsonb not null,
  traps jsonb not null default '[]'::jsonb,
  note text not null,
  expected_drop_cp integer not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint positions_fen_key_key unique (fen_key),
  constraint positions_theme_check check (
    theme in ('hanging', 'fork', 'pin', 'back_rank', 'missed_mate')
  ),
  constraint positions_side_check check (side_to_move in ('w', 'b')),
  constraint positions_square_check check (at_risk_square ~ '^[a-h][1-8]$'),
  constraint positions_fen_key_length check (char_length(fen_key) between 15 and 120),
  constraint positions_fen_length check (char_length(fen) between 15 and 200),
  constraint positions_traps_array check (jsonb_typeof(traps) = 'array'),
  constraint positions_solution_array check (jsonb_typeof(solution) = 'array'),
  constraint positions_acceptable_array check (jsonb_typeof(acceptable) = 'array'),
  constraint positions_prompt_length check (char_length(prompt) between 1 and 200),
  constraint positions_note_length check (char_length(note) between 1 and 500)
);

comment on table public.positions is
  'Shared positions taken from personal games, one row per fen_key. Signed-in users may insert or select. They cannot update or delete.';

create table public.user_drills (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_id text references public.puzzles (id) on delete restrict,
  position_id bigint references public.positions (id) on delete restrict,
  local_id text not null,
  source_game_id text,
  source_move text,
  pasted boolean not null default false,
  sort_index integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  constraint user_drills_user_local_key unique (user_id, local_id),
  constraint user_drills_one_target check (
    (puzzle_id is not null and position_id is null)
    or (puzzle_id is null and position_id is not null)
  ),
  constraint user_drills_local_id_length check (char_length(local_id) between 1 and 80),
  constraint user_drills_source_game_id_public check (
    source_game_id is null or private.is_public_game_id(source_game_id)
  ),
  constraint user_drills_source_move_shape check (
    source_move is null
    or (
      char_length(source_move) between 1 and 32
      and position(chr(10) in source_move) = 0
    )
  ),
  constraint user_drills_sort_index_nonnegative check (sort_index >= 0)
);

comment on table public.user_drills is
  'A user''s library entry. Points at a shared puzzle or a shared position, plus the source game id and move when the scan recorded a real id.';

create table public.review_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_drill_id bigint references public.user_drills (id) on delete set null,
  puzzle_id text references public.puzzles (id) on delete restrict,
  position_id bigint references public.positions (id) on delete restrict,
  saves smallint not null default 0,
  miss_history jsonb not null default '[]'::jsonb,
  due_on date,
  interval_days integer not null default 0,
  pile_index integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint review_entries_one_target check (
    (puzzle_id is not null and position_id is null)
    or (puzzle_id is null and position_id is not null)
  ),
  constraint review_entries_saves_check check (saves in (0, 1)),
  constraint review_entries_miss_history_array check (jsonb_typeof(miss_history) = 'array'),
  constraint review_entries_interval_check check (interval_days >= 0 and interval_days <= 3650),
  constraint review_entries_pile_index_check check (pile_index >= 0)
);

comment on table public.review_entries is
  'Review pile. saves is the current two-save rule. due_on and interval_days mirror it until a scheduler exists.';

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null,
  user_drill_id bigint references public.user_drills (id) on delete set null,
  puzzle_id text references public.puzzles (id) on delete restrict,
  position_id bigint references public.positions (id) on delete restrict,
  move text not null,
  outcome text not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint attempts_user_client_key unique (user_id, client_id),
  constraint attempts_one_target check (
    puzzle_id is not null or position_id is not null
  ),
  constraint attempts_client_id_length check (char_length(client_id) between 1 and 80),
  constraint attempts_move_shape check (
    char_length(move) between 1 and 16
    and position(chr(10) in move) = 0
    and position(' ' in move) = 0
  ),
  constraint attempts_outcome_check check (outcome in ('safe', 'blunder'))
);

comment on table public.attempts is
  'Append-only results. Clients can select and insert. They cannot update or delete.';

create table public.daily_streaks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint daily_streaks_user_date_key unique (user_id, local_date)
);

comment on table public.daily_streaks is
  'Days the player trained. local_date is the calendar date in profiles.timezone, already computed on the device.';

-- Foreign keys are indexed. A leading unique column counts.
-- profiles.id is the primary key and the auth.users foreign key.
-- linked_accounts.user_id: unique (user_id, provider)
-- scanned_games.user_id: unique (user_id, provider, game_id)
-- user_drills.user_id: unique (user_id, local_id)
-- attempts.user_id: unique (user_id, client_id)
-- daily_streaks.user_id: unique (user_id, local_date)
create unique index user_drills_user_puzzle_key
  on public.user_drills (user_id, puzzle_id)
  where puzzle_id is not null;

create unique index user_drills_user_position_key
  on public.user_drills (user_id, position_id)
  where position_id is not null;

create index user_drills_puzzle_id_idx on public.user_drills (puzzle_id);
create index user_drills_position_id_idx on public.user_drills (position_id);

create index review_entries_user_id_due_idx on public.review_entries (user_id, due_on);
create index review_entries_user_drill_id_idx on public.review_entries (user_drill_id);
create index review_entries_puzzle_id_idx on public.review_entries (puzzle_id);
create index review_entries_position_id_idx on public.review_entries (position_id);

create unique index review_entries_user_puzzle_key
  on public.review_entries (user_id, puzzle_id)
  where puzzle_id is not null;

create unique index review_entries_user_position_key
  on public.review_entries (user_id, position_id)
  where position_id is not null;

create index attempts_user_created_idx on public.attempts (user_id, created_at);
create index attempts_user_drill_id_idx on public.attempts (user_drill_id);
create index attempts_puzzle_id_idx on public.attempts (puzzle_id);
create index attempts_position_id_idx on public.attempts (position_id);

-- RLS is enabled and not forced. The table owner bypasses it, which is what
-- the signup trigger and the account-deletion cascade need on projects where
-- postgres is not a superuser. API roles do not own the tables, so policies apply.
alter table public.profiles enable row level security;
alter table public.linked_accounts enable row level security;
alter table public.scanned_games enable row level security;
alter table public.puzzles enable row level security;
alter table public.positions enable row level security;
alter table public.user_drills enable row level security;
alter table public.review_entries enable row level security;
alter table public.attempts enable row level security;
alter table public.daily_streaks enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.linked_accounts from public, anon, authenticated;
revoke all on table public.scanned_games from public, anon, authenticated;
revoke all on table public.puzzles from public, anon, authenticated;
revoke all on table public.positions from public, anon, authenticated;
revoke all on table public.user_drills from public, anon, authenticated;
revoke all on table public.review_entries from public, anon, authenticated;
revoke all on table public.attempts from public, anon, authenticated;
revoke all on table public.daily_streaks from public, anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.linked_accounts to authenticated;
grant select, insert, update, delete on table public.scanned_games to authenticated;
grant select, insert, update, delete on table public.user_drills to authenticated;
grant select, insert, update, delete on table public.review_entries to authenticated;
grant select, insert, update, delete on table public.daily_streaks to authenticated;

grant select on table public.puzzles to anon, authenticated;
grant select, insert on table public.positions to authenticated;
grant select, insert on table public.attempts to authenticated;

revoke all on sequence public.linked_accounts_id_seq from public, anon, authenticated;
revoke all on sequence public.scanned_games_id_seq from public, anon, authenticated;
revoke all on sequence public.positions_id_seq from public, anon, authenticated;
revoke all on sequence public.user_drills_id_seq from public, anon, authenticated;
revoke all on sequence public.review_entries_id_seq from public, anon, authenticated;
revoke all on sequence public.attempts_id_seq from public, anon, authenticated;
revoke all on sequence public.daily_streaks_id_seq from public, anon, authenticated;

grant usage, select on sequence public.linked_accounts_id_seq to authenticated;
grant usage, select on sequence public.scanned_games_id_seq to authenticated;
grant usage, select on sequence public.positions_id_seq to authenticated;
grant usage, select on sequence public.user_drills_id_seq to authenticated;
grant usage, select on sequence public.review_entries_id_seq to authenticated;
grant usage, select on sequence public.attempts_id_seq to authenticated;
grant usage, select on sequence public.daily_streaks_id_seq to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using ((select auth.uid()) = id);

create policy linked_accounts_select_own
  on public.linked_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy linked_accounts_insert_own
  on public.linked_accounts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy linked_accounts_update_own
  on public.linked_accounts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy linked_accounts_delete_own
  on public.linked_accounts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy scanned_games_select_own
  on public.scanned_games
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy scanned_games_insert_own
  on public.scanned_games
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy scanned_games_update_own
  on public.scanned_games
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy scanned_games_delete_own
  on public.scanned_games
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy puzzles_select_anon
  on public.puzzles
  for select
  to anon
  using (true);

create policy puzzles_select_authenticated
  on public.puzzles
  for select
  to authenticated
  using (true);

create policy positions_select_authenticated
  on public.positions
  for select
  to authenticated
  using (true);

create policy positions_insert_authenticated
  on public.positions
  for insert
  to authenticated
  with check (true);

create policy user_drills_select_own
  on public.user_drills
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_drills_insert_own
  on public.user_drills
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_drills_update_own
  on public.user_drills
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_drills_delete_own
  on public.user_drills
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy review_entries_select_own
  on public.review_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy review_entries_insert_own
  on public.review_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy review_entries_update_own
  on public.review_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy review_entries_delete_own
  on public.review_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy attempts_select_own
  on public.attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy attempts_insert_own
  on public.attempts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy daily_streaks_select_own
  on public.daily_streaks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy daily_streaks_insert_own
  on public.daily_streaks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy daily_streaks_update_own
  on public.daily_streaks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy daily_streaks_delete_own
  on public.daily_streaks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger linked_accounts_set_updated_at
  before update on public.linked_accounts
  for each row execute function private.set_updated_at();

create trigger linked_accounts_force_chesscom_unverified
  before insert or update on public.linked_accounts
  for each row execute function private.force_chesscom_unverified();

create trigger review_entries_set_updated_at
  before update on public.review_entries
  for each row execute function private.set_updated_at();

-- Copies a display name only. raw_user_meta_data is not used for authorization.
-- pg_catalog.coalesce is not a function. 20261115024156_fix_handle_new_user_coalesce.sql replaces this.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(pg_catalog.left(pg_catalog.coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

grant usage on schema private to authenticated;
grant execute on function private.set_updated_at() to authenticated;
grant execute on function private.force_chesscom_unverified() to authenticated;
grant execute on function private.delete_auth_user() to authenticated;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.delete_auth_user();
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the signed-in auth user. Profile, drills, reviews, attempts, and streaks cascade.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
