import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createHomeSession,
  createReviewSession,
  createThemeSession,
  getAllDrills,
  type DrillPosition,
} from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';
import {
  buildPoolForTheme,
  buildPuzzlePool,
  keepOwnDrills,
  mergeScannedDrills,
  poolSummary,
  PUZZLE_POOL_SIZE,
  reviewId,
  reviewMiss,
} from '@/src/logic/puzzlePool';

function own(n: number): DrillPosition {
  const base = getAllDrills()[0];
  if (!base) throw new Error('starter bank is empty');
  return { ...base, id: `own-${n}`, fen: `unique-${n} w - - 0 1` };
}

describe('puzzle pool', () => {
  it('fills 100 unique starters, and still cycles when the starter list is short', () => {
    const empty = buildPuzzlePool([]);
    expect(empty).toHaveLength(PUZZLE_POOL_SIZE);
    expect(empty[0]?.id).toBe(getAllDrills()[0]?.id);
    expect(new Set(empty.map((drill) => fenKey(drill.fen))).size).toBe(PUZZLE_POOL_SIZE);
    const cycled = buildPuzzlePool([], getAllDrills().slice(0, 3));
    expect(cycled.some((drill) => drill.id.includes('~'))).toBe(true);
    expect(reviewId(cycled.find((drill) => drill.id.includes('~'))?.id ?? '')).toBe(
      cycled.find((drill) => drill.id.includes('~'))?.id.split('~')[0],
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

  it('records a repeated starter under the bank id and keeps a personal position', () => {
    const bank = getAllDrills().find((drill) => drill.id === 'hang-q-01');
    expect(bank).toBeTruthy();
    if (!bank) return;
    const repeated = reviewMiss({ ...bank, id: `${bank.id}~1` });
    expect(repeated).toEqual({ id: 'hang-q-01' });
    expect(createReviewSession([repeated.id]).positions.map((drill) => drill.id)).toEqual(['hang-q-01']);
    expect(createReviewSession([`${bank.id}~1`]).positions).toHaveLength(0);

    const personal = { ...bank, id: 'own-7' };
    expect(reviewMiss(personal)).toEqual({ id: 'own-7', drill: personal });

    const commit = readFileSync(new URL('../store/trainerResult.ts', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../components/home/useHomeTrainer.ts', import.meta.url), 'utf8');
    const play = readFileSync(new URL('../components/drills/useDrillSession.ts', import.meta.url), 'utf8');
    const pick = readFileSync(new URL('../components/drills/useSafeChoiceSession.ts', import.meta.url), 'utf8');
    expect(commit).toContain('reviewMiss(');
    for (const source of [home, play, pick]) {
      expect(source).toContain('applyRoundEffects(');
      expect(source).not.toContain('recordMiss(');
    }
  });

  it('keeps pasted drills a full scan did not return, and drops the previous scan', () => {
    const pasted = own(1);
    const previous = own(2);
    const updated = { ...pasted, note: 'from the scan' };
    const replaced = mergeScannedDrills([pasted], [updated, own(3)], [pasted.id]);
    expect(replaced.map((drill) => drill.id)).toEqual([updated.id, 'own-3']);
    expect(replaced[0]?.note).toBe('from the scan');

    const scanned = Array.from({ length: PUZZLE_POOL_SIZE }, (_, index) => own(index + 3));
    const merged = mergeScannedDrills([pasted, previous], scanned, [pasted.id]);
    expect(merged[0]?.id).toBe(pasted.id);
    expect(merged).toHaveLength(PUZZLE_POOL_SIZE);
    expect(merged.some((drill) => drill.id === previous.id)).toBe(false);
    expect(merged.filter((drill) => drill.id !== pasted.id)).toHaveLength(PUZZLE_POOL_SIZE - 1);
  });

  it('describes how the starter set fills the gap', () => {
    expect(poolSummary(0)).toMatch(/Starter puzzles/);
    expect(poolSummary(1)).toMatch(/1 from your games/);
    expect(poolSummary(100)).toBe('100 from your games.');
    expect(keepOwnDrills([own(1), own(1), own(2)])).toHaveLength(2);
  });

  it('keeps every starter puzzle of a filtered theme instead of slicing at 100', () => {
    const allBackRank = getAllDrills().filter((drill) => drill.theme === 'back_rank');
    expect(allBackRank.length).toBeGreaterThan(20);
    const pool = buildPoolForTheme([], 'back_rank');
    expect(pool).toHaveLength(allBackRank.length);
    const personalBack: DrillPosition = { ...allBackRank[0]!, id: 'own-back-1', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1' };
    const withPersonal = buildPoolForTheme([personalBack], 'back_rank');
    expect(withPersonal[0]?.id).toBe('own-back-1');
    expect(withPersonal).toHaveLength(allBackRank.length + 1);
  });
});
