import { describe, expect, it } from 'vitest';

import {
  appendIncomingPuzzles,
  EARLY_PLAY_COUNT,
  leadWithPersonal,
  nextSessionPositions,
  playUnlocked,
  puzzleCounter,
  scanNote,
} from '@/src/logic/earlyPlay';
import { getAllDrills, type DrillPosition } from '@/src/logic/drills';
import { buildPuzzlePool } from '@/src/logic/puzzlePool';

function drill(id: string): DrillPosition {
  const base = getAllDrills()[0];
  if (!base) throw new Error('starter bank is empty');
  return { ...base, id, fen: `${id} w - - 0 1` };
}

describe('early play', () => {
  it('unlocks at 3 while more blunders are still coming', () => {
    expect(EARLY_PLAY_COUNT).toBe(3);
    expect(playUnlocked({ found: 2, incoming: true, failed: false })).toBe(false);
    expect(playUnlocked({ found: 3, incoming: true, failed: false })).toBe(true);
    expect(playUnlocked({ found: 12, incoming: true, failed: false })).toBe(true);
  });

  it('unlocks with fewer than 3 once nothing else is coming', () => {
    expect(playUnlocked({ found: 2, incoming: false, failed: false })).toBe(true);
    expect(playUnlocked({ found: 0, incoming: false, failed: false })).toBe(true);
    expect(playUnlocked({ found: 1, incoming: true, failed: false })).toBe(false);
  });

  it('keeps a partial result after an error and stays on the form when nothing was saved', () => {
    expect(playUnlocked({ found: 4, incoming: false, failed: true })).toBe(true);
    expect(playUnlocked({ found: 1, incoming: false, failed: true })).toBe(true);
    expect(playUnlocked({ found: 0, incoming: false, failed: true })).toBe(false);
  });

  it('appends new blunders without replacing the current puzzle or growing the list', () => {
    const current = [drill('p1'), drill('p2'), drill('s1'), drill('s2')];
    const next = appendIncomingPuzzles(current, [drill('p1'), drill('p2'), drill('p3')], 1);
    expect(next).toHaveLength(current.length);
    expect(next[1]).toBe(current[1]);
    expect(next.map((item) => item.id)).toEqual(['p1', 'p2', 'p3', 's1']);
  });

  it('keeps cycled starter fillers so a 100-puzzle session does not shrink', () => {
    const personal = [drill('p1'), drill('p2'), drill('p3')];
    const current = buildPuzzlePool(personal);
    const next = appendIncomingPuzzles(current, [...personal, drill('p4')], 0);
    expect(current).toHaveLength(100);
    expect(next).toHaveLength(100);
    expect(next[0]).toBe(current[0]);
    expect(next.map((item) => item.id)).toContain('p4');
    expect(next.some((item) => item.id.includes('~'))).toBe(true);
  });

  it('holds the board until play unlocks, then adopts once and appends after that', () => {
    const starters = [drill('s1'), drill('s2'), drill('s3'), drill('s4')];
    const first = [drill('p1'), drill('p2')];
    const held = nextSessionPositions({
      current: starters,
      personal: first,
      rebuilt: [...first, drill('s1'), drill('s2')],
      index: 0,
      engaged: false,
      committed: false,
      unlocked: false,
      scanning: true,
    });
    expect(held.positions).toBeNull();
    expect(held.committed).toBe(false);

    const ready = [drill('p1'), drill('p2'), drill('p3')];
    const adopted = nextSessionPositions({
      current: starters,
      personal: ready,
      rebuilt: [...ready, drill('s1')],
      index: 0,
      engaged: false,
      committed: false,
      unlocked: true,
      scanning: true,
    });
    expect(adopted.committed).toBe(true);
    expect(adopted.positions?.map((item) => item.id)).toEqual(['p1', 'p2', 'p3', 's1']);

    const grown = nextSessionPositions({
      current: adopted.positions ?? [],
      personal: [...ready, drill('p4')],
      rebuilt: [...ready, drill('p4')],
      index: 0,
      engaged: false,
      committed: adopted.committed,
      unlocked: true,
      scanning: true,
    });
    expect(grown.positions?.[0]?.id).toBe('p1');
    expect(grown.positions?.[0]).toBe(adopted.positions?.[0]);
    expect(grown.positions?.map((item) => item.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('starts a short finished scan with what was found, and an error does not drop the current puzzle', () => {
    const starters = [drill('s1'), drill('s2'), drill('s3')];
    const found = [drill('p1'), drill('p2')];
    const ended = nextSessionPositions({
      current: starters,
      personal: found,
      rebuilt: [...found, drill('s1')],
      index: 0,
      engaged: false,
      committed: false,
      unlocked: true,
      scanning: false,
    });
    expect(ended.positions?.map((item) => item.id)).toEqual(['p1', 'p2', 's1']);

    const playing = [drill('p1'), drill('p2'), drill('p3'), drill('s1')];
    const afterError = nextSessionPositions({
      current: playing,
      personal: [drill('p1'), drill('p2'), drill('p3')],
      rebuilt: [],
      index: 1,
      engaged: true,
      committed: true,
      unlocked: true,
      scanning: false,
    });
    expect(afterError.positions?.[1]).toBe(playing[1]);
    expect(afterError.positions?.map((item) => item.id)).toEqual(['p1', 'p2', 'p3', 's1']);
  });

  it('leads a short home pack with personal blunders and leaves a full pack alone', () => {
    const session = [drill('s1'), drill('s2'), drill('s3'), drill('s4')];
    expect(leadWithPersonal(session, [drill('p1'), drill('p2')], 4).map((item) => item.id)).toEqual([
      'p1',
      'p2',
      's1',
      's2',
    ]);
    expect(leadWithPersonal(session, [drill('p1'), drill('p2'), drill('p3'), drill('p4')], 4)).toEqual(session);
  });

  it('keeps the resting counter on one line and adds a scan note beside it', () => {
    expect(puzzleCounter(0, 100, null, false)).toBe('1/100');
    expect(puzzleCounter(0, 7, null, true)).toBe('1 / 7');
    expect(puzzleCounter(2, 100, '4 found', false)).toBe('3/100 · 4 found');
    expect(scanNote('scanning', 4)).toBe('4 found');
    expect(scanNote('scanning', 0)).toBeNull();
    expect(scanNote('error', 4)).toBe('scan stopped');
    expect(scanNote('done', 4)).toBeNull();
    expect(scanNote('idle', 4)).toBeNull();
  });
});
