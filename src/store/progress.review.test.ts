import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

import type { Square } from 'chess.js';

import { reviewForEntries } from '@/src/logic/drillLink';
import { getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { drillFromHang } from '@/src/logic/personalDrill';
import { reviewMiss } from '@/src/logic/puzzlePool';
import { reviewFromSaved } from '@/src/logic/reviewPile';
import { useProgressStore } from '@/src/store/progress';

const HANGING_QUEEN = 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3';

describe('progress review pile', () => {
  beforeEach(() => {
    useProgressStore.setState({
      review: [],
      missedIds: [],
      missedDate: '2020-01-01',
      ownDrills: [],
      pastedIds: [],
      gameProfile: null,
    });
  });

  it('keeps an older miss when a new one is recorded, and drops it on the second save', () => {
    useProgressStore.setState({
      review: [{ id: 'hang-q-01', saves: 1 }],
      missedIds: ['hang-q-01'],
      missedDate: '2020-01-01',
    });
    useProgressStore.getState().recordMiss('mate-03');
    expect(useProgressStore.getState().missedIds).toEqual(['mate-03', 'hang-q-01']);
    expect(useProgressStore.getState().review.find((entry) => entry.id === 'hang-q-01')?.saves).toBe(1);

    useProgressStore.getState().recordSave('hang-q-01');
    expect(useProgressStore.getState().missedIds).toEqual(['mate-03']);

    useProgressStore.getState().recordMiss('mate-03');
    expect(useProgressStore.getState().review.find((entry) => entry.id === 'mate-03')?.saves).toBe(0);
  });

  it('stores one practice position and replaces it when the same game is imported', () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    useProgressStore.getState().savePersonalDrill(drill);
    expect(useProgressStore.getState().review[0]?.saves).toBe(0);
    useProgressStore.getState().recordSave(drill.id);
    useProgressStore.getState().savePersonalDrill(drill);
    expect(useProgressStore.getState().review).toHaveLength(1);
    expect(useProgressStore.getState().review[0]?.saves).toBe(1);

    useProgressStore.getState().saveImportedDrills([drill]);
    expect(useProgressStore.getState().review).toHaveLength(1);
    expect(useProgressStore.getState().review[0]?.saves).toBe(1);
    expect(useProgressStore.getState().ownDrills).toHaveLength(1);

    useProgressStore.getState().resetProgress();
    expect(useProgressStore.getState().review).toEqual([]);
    expect(useProgressStore.getState().ownDrills).toEqual([]);
    expect(useProgressStore.getState().pastedIds).toEqual([]);
    expect(useProgressStore.getState().gameProfile).toBeNull();
  });

  it('resolves a repeated home id to the bank puzzle', () => {
    const bank = getAllDrills().find((drill) => drill.id === 'hang-q-01');
    expect(bank).toBeTruthy();
    if (!bank) return;
    const miss = reviewMiss({ ...bank, id: `${bank.id}~1` });
    useProgressStore.getState().recordMiss(miss.id, miss.drill);
    expect(useProgressStore.getState().missedIds).toEqual(['hang-q-01']);
    expect(useProgressStore.getState().review[0]?.drill).toBeUndefined();
    expect(reviewForEntries(useProgressStore.getState().review, 'all').positions[0]?.id).toBe('hang-q-01');
  });

  it('replays a personal miss after the saved list is gone and after a reload', () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    const miss = reviewMiss(drill);
    useProgressStore.getState().recordMiss(miss.id, miss.drill);
    expect(useProgressStore.getState().review[0]).toMatchObject({ id: drill.id, saves: 0 });
    expect(useProgressStore.getState().review[0]?.drill?.fen).toBe(drill.fen);

    useProgressStore.getState().recordSave(drill.id);
    useProgressStore.getState().recordMiss(drill.id);
    expect(useProgressStore.getState().review[0]?.saves).toBe(0);
    expect(useProgressStore.getState().review[0]?.drill?.note).toBe(drill.note);

    const restored = reviewFromSaved(
      JSON.parse(JSON.stringify({ review: useProgressStore.getState().review })) as { review: unknown },
    );
    const session = reviewForEntries(restored, 'all');
    expect(session.positions.map((item) => item.id)).toEqual([drill.id]);
    expect(reviewForEntries(restored, 'fork').positions).toHaveLength(0);
    const position = session.positions[0];
    const save = position?.solution[0];
    expect(save && save.length >= 4).toBeTruthy();
    if (!position || !save) return;
    expect(isCorrectDrillMove(position, save.slice(0, 2) as Square, save.slice(2, 4) as Square)).toBe(true);
  });

  it('attaches a personal miss from the saved list when only the id was recorded', () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    useProgressStore.setState({ ownDrills: [drill] });
    useProgressStore.getState().recordMiss(drill.id);
    const restored = reviewFromSaved(
      JSON.parse(JSON.stringify({ review: useProgressStore.getState().review })) as { review: unknown },
    );
    expect(restored[0]?.drill?.id).toBe(drill.id);
    expect(reviewForEntries(restored, drill.theme).positions).toHaveLength(1);
  });
});
