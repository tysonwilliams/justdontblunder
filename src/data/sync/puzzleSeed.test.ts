import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import bankJson from '@/src/data/beginner-blunders.json';
import { buildPuzzleSeedSql, PUZZLE_LICENSE, PUZZLE_SOURCE, type SeedPuzzle } from '@/src/data/sync/puzzleSeed';

const bank = bankJson as SeedPuzzle[];

describe('puzzle seed', () => {
  it('writes an idempotent upsert for every starter position', () => {
    expect(bank).toHaveLength(180);
    const sql = buildPuzzleSeedSql(bank);
    const file = fs.readFileSync(path.join(process.cwd(), 'supabase/seeds/puzzles.sql'), 'utf8');
    expect(file).toBe(sql);
    expect(sql).toContain('on conflict (id) do update set');
    expect(sql).not.toContain('created_at = excluded.created_at');
    expect(sql.split(`'${PUZZLE_SOURCE}'`).length - 1).toBe(180);
    expect(sql).toContain(`'${PUZZLE_LICENSE}'`);
    expect(sql).toContain("pawn''s");
    expect(new Set(bank.map((puzzle) => puzzle.id)).size).toBe(180);
  });
});
