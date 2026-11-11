import { describe, expect, it } from 'vitest';

import { createHomeSession, createThemeSession, getAllDrills, type DrillPosition } from '@/src/logic/drills';
import { buildPuzzlePool, keepOwnDrills, poolSummary, PUZZLE_POOL_SIZE, reviewId } from '@/src/logic/puzzlePool';

function own(n: number): DrillPosition {
  const base = getAllDrills()[0];
  if (!base) throw new Error('starter bank is empty');
  return { ...base, id: `own-${n}`, fen: `unique-${n} w - - 0 1` };
}

describe('puzzle pool', () => {
  it('cycles starter puzzles until the list reaches 100, and never repeats a personal position', () => {
    const empty = buildPuzzlePool([]);
    expect(empty).toHaveLength(PUZZLE_POOL_SIZE);
    expect(empty[0]?.id).toBe(getAllDrills()[0]?.id);
    expect(empty.some((drill) => drill.id.includes('~'))).toBe(true);
    expect(reviewId(empty.find((drill) => drill.id.includes('~'))?.id ?? '')).toBe(
      empty.find((drill) => drill.id.includes('~'))?.id.split('~')[0],
    );

    const repeated = buildPuzzlePool([own(1), own(1)]);
    expect(repeated.filter((drill) => drill.id === 'own-1')).toHaveLength(1);
    expect(repeated).toHaveLength(PUZZLE_POOL_SIZE);

    const full = buildPuzzlePool(Array.from({ length: 120 }, (_, index) => own(index)));
    expect(full).toHaveLength(PUZZLE_POOL_SIZE);
    expect(full.every((drill) => drill.id.startsWith('own-'))).toBe(true);
  });

  it('filters a theme without padding it, and home still draws a short pack from the pool', () => {
    const pool = buildPuzzlePool([]);
    const forks = createThemeSession('fork', pool);
    expect(forks.positions.length).toBeGreaterThan(0);
    expect(forks.positions.length).toBeLessThan(PUZZLE_POOL_SIZE);
    expect(forks.positions.every((drill) => drill.theme === 'fork')).toBe(true);

    const date = new Date('2026-10-31T12:00:00Z');
    const home = createHomeSession(date, undefined, pool);
    expect(home.positions).toHaveLength(7);
    const two = getAllDrills().slice(0, 2);
    expect(createHomeSession(date, undefined, two).positions).toHaveLength(2);
  });

  it('describes how the starter set fills the gap', () => {
    expect(poolSummary(0)).toMatch(/Starter puzzles/);
    expect(poolSummary(1)).toMatch(/1 from your games/);
    expect(poolSummary(100)).toBe('100 from your games.');
    expect(keepOwnDrills([own(1), own(1), own(2)])).toHaveLength(2);
  });
});
