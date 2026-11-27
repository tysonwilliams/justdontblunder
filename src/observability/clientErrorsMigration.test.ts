import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const file = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../supabase/migrations/20261126233000_client_errors.sql',
);

describe('client_errors migration', () => {
  const sql = readFileSync(file, 'utf8');
  const table = sql.slice(sql.indexOf('create table'), sql.indexOf(');') + 2);

  it('stores a crash row without an account, an email, or an IP', () => {
    expect(table).toContain('message text not null');
    expect(table).toContain('stack text');
    expect(table).toContain('route text');
    expect(table).toContain('app_version text not null');
    expect(table).toContain('platform text not null');
    expect(table).not.toMatch(/user_id|email|ip_address/i);
  });

  it('is insert-only for anon and authenticated', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('grant insert on table public.client_errors to anon, authenticated');
    expect(sql).toContain('for insert');
    expect(sql).toContain('to anon');
    expect(sql).toContain('to authenticated');
    expect(sql).not.toMatch(/for select|for update|for delete|grant select|grant update|grant delete/i);
  });
});
