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

import { drillFromHang } from '@/src/logic/personalDrill';
import { useProgressStore } from '@/src/store/progress';

const HANGING_QUEEN = 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3';

describe('progress review pile', () => {
  beforeEach(() => {
    useProgressStore.setState({ review: [], missedIds: [], missedDate: '2020-01-01' });
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
    expect(useProgressStore.getState().review[0]?.saves).toBe(0);
    useProgressStore.getState().resetProgress();
    expect(useProgressStore.getState().review).toEqual([]);
  });
});
