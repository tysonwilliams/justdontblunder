# Supabase data layer

Sync is off unless `EXPO_PUBLIC_SYNC_ENABLED` is the string `true` and both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set. Missing config leaves the client null. Play stays on the device, with no sign-in screen. Guest progress in AsyncStorage remains the cache.

This repo does not apply the schema to the hosted project. Review the SQL, then apply it yourself.

## Apply the schema

The migration is `supabase/migrations/20261114220421_init_data_layer.sql`. Hosted project ref: `nhnozbrwyiiynargawmc`.

```bash
npx supabase link --project-ref nhnozbrwyiiynargawmc
npx supabase db push
```

`db push` applies migrations only. It does not run `supabase/seeds/puzzles.sql`.

`supabase/config.toml` is for a local Docker stack (`project_id` is the local id, not the hosted ref). Do not `supabase config push`. That would change the hosted auth site URL and redirect list.

A local `npx supabase db reset` applies the migrations and the puzzle seed, because `config.toml` lists `./seeds/puzzles.sql`.

## Seed the starter bank

`scripts/seed-puzzles.mts` writes an idempotent upsert of all 160 positions in `src/data/beginner-blunders.json`. Source is `beginner-blunders`. License is `All rights reserved`. These positions are generated in this repo.

```bash
npm run seed:puzzles
```

Run `supabase/seeds/puzzles.sql` as the database owner (the seed bypasses RLS; the anon key cannot write `puzzles`):

```bash
npx supabase db query -f supabase/seeds/puzzles.sql --linked
```

Re-running the file updates the teaching columns and does not reset `created_at`.

## Vercel

Set these on the project, then redeploy. Expo inlines `EXPO_PUBLIC_*` at build time, so a running deployment does not pick up a later env change until the next build.

| Name | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://nhnozbrwyiiynargawmc.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the publishable (anon) key |
| `EXPO_PUBLIC_SYNC_ENABLED` | `false` until sign-in exists and you want sync |

Never put the service role key in `EXPO_PUBLIC_*`. The client refuses a JWT whose `role` is `service_role`.

## What is stored

| Table | Who can read | Who can write |
| --- | --- | --- |
| `profiles` | the signed-in user, `id = auth.uid()` | that user. A trigger on `auth.users` inserts the row. |
| `linked_accounts` | that user | that user. Chess.com `verified` stays false (check and trigger). |
| `scanned_games` | that user | that user. Game ids only. No PGN column. |
| `puzzles` | anon and authenticated | nobody from the client. The owner seeds it. |
| `positions` | authenticated | authenticated insert only. `fen_key` dedupes. No client update or delete. |
| `user_drills` | that user | that user. One of `puzzle_id` or `position_id`. |
| `review_entries` | that user | that user. |
| `attempts` | that user | insert only. No update or delete policy. |
| `daily_streaks` | that user | that user. `local_date` is the device calendar date for `profiles.timezone`. |

RLS is enabled on every table. User-owned policies use `(select auth.uid())`. RLS is not forced: the table owner still bypasses it, which the signup trigger and the delete cascade need when `postgres` is not a superuser. API roles do not own the tables.

`private` is not in the exposed API schemas. Security-definer functions live there with `search_path = ''`. `public.delete_my_account()` is the RPC a signed-in user calls to delete their `auth.users` row. Everything owned by that id cascades. There is no button for it yet. Ship this before any sign-in UI.

Username scans still run in the browser. Sync uploads the cursor and the public game ids. Fallback ids that embed PGN text stay in AsyncStorage and are not uploaded.

## Sync

`src/data/sync` maps the `jdb-progress-v1` version-2 slices (`training`, `review`, `library`, `preferences`, `scan`) onto these tables. Extra columns on `profiles`, `user_drills`, and `review_entries` hold the counters, lesson ids, pool order, and review schedule that the local document already stores.

With the flag on and a session present, sign-in pulls, merges, saves the merge locally, then pushes. Local rows win when the two sides disagree. Lists and counters are unions and maximums, so a guest drill, review, attempt, lesson, or seen game is not dropped. The puzzle pool cap keeps guest drills first. Push is skipped while a scan is running on this device.
