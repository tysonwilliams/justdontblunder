import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
const sql = fs.readFileSync(path.join(migrationsDir, '20261114220421_init_data_layer.sql'), 'utf8');

const tables = [
  'profiles',
  'linked_accounts',
  'scanned_games',
  'puzzles',
  'positions',
  'user_drills',
  'review_entries',
  'attempts',
  'daily_streaks',
];

describe('data layer migration', () => {
  it('enables RLS on every table and keys user rows to auth.uid()', () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(sql.toLowerCase()).not.toContain('force row level security');
    expect(sql).toContain('(select auth.uid())');
    expect(sql).toContain("set search_path = ''");
  });

  it('deletes the caller through a private security-definer function', () => {
    expect(sql).toContain('create or replace function private.delete_auth_user()');
    expect(sql).toContain('security definer');
    expect(sql).toContain('create or replace function public.delete_my_account()');
    expect(sql).toContain('security invoker');
    expect(sql).toContain('delete from auth.users where id = uid;');
    expect(sql).toContain('grant execute on function public.delete_my_account() to authenticated;');
  });

  it('keeps Chess.com unverified and has no PGN column', () => {
    expect(sql).toContain("provider <> 'chesscom' or verified = false");
    expect(sql).toContain('private.force_chesscom_unverified()');
    expect(sql).not.toMatch(/^\s+pgn\s/m);
    expect(sql).toContain('create schema if not exists private;');
  });

  it('lets anon read puzzles and blocks client writes, and leaves attempts append-only', () => {
    expect(sql).toContain('create policy puzzles_select_anon');
    expect(sql).toContain('create policy puzzles_select_authenticated');
    expect(sql).not.toContain('puzzles_insert');
    expect(sql).toContain('create policy positions_insert_authenticated');
    expect(sql).not.toContain('positions_update');
    expect(sql).not.toContain('positions_delete');
    expect(sql).toContain('create policy attempts_select_own');
    expect(sql).toContain('create policy attempts_insert_own');
    expect(sql).not.toContain('attempts_update');
    expect(sql).not.toContain('attempts_delete');
    expect(sql).not.toMatch(/on public\.attempts\s+for update/);
    expect(sql).not.toMatch(/on public\.attempts\s+for delete/);
  });

  it('marks old two-save review rows due now and leaves a packed schedule alone', () => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();
    expect(files).toContain('20261126180000_review_spaced_repetition.sql');
    const schedule = fs.readFileSync(
      path.join(migrationsDir, '20261126180000_review_spaced_repetition.sql'),
      'utf8',
    );
    expect(schedule).toContain('update public.review_entries');
    expect(schedule).toContain('interval_days = 0');
    expect(schedule).toContain('saves = 0');
    expect(schedule).toContain('interval_days > 0 and interval_days < 100');
    expect(schedule).toContain('interval_days >= 100');
    expect(schedule).toContain('due_on is null');
    expect(schedule.toLowerCase()).not.toContain('drop table');
    expect(schedule.toLowerCase()).not.toContain('service_role');
    expect(schedule).not.toContain('db push');
  });

  it('replaces handle_new_user with plain coalesce', () => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();
    expect(files).toContain('20261115024156_fix_handle_new_user_coalesce.sql');
    const combined = files.map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n');
    const definitions = [
      ...combined.matchAll(/create or replace function private\.handle_new_user\(\)[\s\S]*?\$\$;/gi),
    ];
    const latest = definitions.at(-1)?.[0] ?? '';
    expect(latest.toLowerCase()).toContain('security definer');
    expect(latest.toLowerCase()).toContain("set search_path = ''");
    expect(latest).toContain("coalesce(new.raw_user_meta_data ->> 'display_name', '')");
    expect(latest).not.toContain('pg_catalog.coalesce');
  });
});
