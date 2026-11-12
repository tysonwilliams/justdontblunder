import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { localDateKey } from '@/src/logic/localDate';
import { useProgressStore } from '@/src/store/progress';

const previousTz = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

describe('daily streak', () => {
  it('stays on the local evening after UTC midnight, and continues from the previous local day', () => {
    process.env.TZ = 'America/Denver';
    const evening = new Date('2026-11-13T00:30:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(evening);

    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(localDateKey()).toBe('2026-11-12');

    useProgressStore.setState({ dailyStreak: 4, lastDrillDate: '2026-11-12', recordStreak: 4 });
    useProgressStore.getState().markDrillResult(true, 'hanging');
    expect(useProgressStore.getState().dailyStreak).toBe(4);
    expect(useProgressStore.getState().lastDrillDate).toBe('2026-11-12');

    useProgressStore.setState({ dailyStreak: 4, lastDrillDate: '2026-11-11' });
    useProgressStore.getState().markDrillResult(true, 'hanging');
    expect(useProgressStore.getState().dailyStreak).toBe(5);
    expect(useProgressStore.getState().lastDrillDate).toBe('2026-11-12');

    useProgressStore.setState({ dailyStreak: 4, lastDrillDate: '2026-11-10' });
    useProgressStore.getState().markDrillResult(true, 'hanging');
    expect(useProgressStore.getState().dailyStreak).toBe(1);
    expect(useProgressStore.getState().lastDrillDate).toBe('2026-11-12');
  });
});
