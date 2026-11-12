import { Chess } from 'chess.js';
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

import AsyncStorage from '@react-native-async-storage/async-storage';

import { playUnlocked } from '@/src/logic/earlyPlay';
import { resetOwnScanForTests, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { SCAN_PERSIST_INTERVAL_MS } from '@/src/store/progressStorage';

function queenHang(second: string): string {
  const game = new Chess();
  game.move('e4');
  game.move('Nf6');
  game.move(second);
  game.move('a6');
  game.move('Qh5');
  game.move('Nxh5');
  return game.pgn();
}

function games(openings: readonly string[], end: number) {
  return openings.map((second, index) => ({
    pgn: queenHang(second),
    time_class: 'rapid',
    end_time: end - index,
    white: { username: 'Me' },
    black: { username: 'them' },
  }));
}

function json(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const newer = 'https://api.chess.com/pub/player/me/games/2026/11';
const older = 'https://api.chess.com/pub/player/me/games/2026/10';

describe('own scan', () => {
  beforeEach(() => {
    resetOwnScanForTests();
    useProgressStore.setState({
      ownDrills: [],
      gameProfile: null,
      scanPromptDismissed: false,
      scan: { phase: 'idle', found: 0, games: 0, message: '', incoming: false },
    });
  });

  it('unlocks play at 3 blunders and keeps scanning', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let earlyCount = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/archives')) return json({ archives: [older, newer] });
      if (String(url) === newer) return json({ games: games(['a3', 'a4', 'b3'], 30) });
      earlyCount = useProgressStore.getState().ownDrills.length;
      await gate;
      return json({ games: games(['c3', 'c4', 'd3'], 10) });
    });
    const pending = runOwnScan('chesscom', 'Me', fetchImpl);
    try {
      await waitUntil(() => earlyCount >= 3);
      const scan = useProgressStore.getState().scan;
      expect(scan.phase).toBe('scanning');
      expect(scan.incoming).toBe(true);
      expect(scan.found).toBeGreaterThanOrEqual(3);
      expect(playUnlocked({ found: scan.found, incoming: scan.incoming, failed: false })).toBe(true);
      expect(useProgressStore.getState().gameProfile).toBeNull();
      release();
      await expect(pending).resolves.toBe('done');
    } finally {
      release();
      await pending.catch(() => undefined);
    }
    expect(useProgressStore.getState().ownDrills.length).toBeGreaterThan(3);
    expect(useProgressStore.getState().scan.phase).toBe('done');
    expect(useProgressStore.getState().scan.incoming).toBe(false);
    expect(useProgressStore.getState().gameProfile).toEqual({ site: 'chesscom', username: 'Me' });
    const saved = savedProgress();
    expect(saved.ownDrills).toHaveLength(useProgressStore.getState().ownDrills.length);
    expect(saved.scan).toMatchObject({ phase: 'done', incoming: false });
  });

  it('keeps blunders already found when a later request fails', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/archives')) return json({ archives: [older, newer] });
      if (String(url) === newer) return json({ games: games(['a3', 'a4', 'b3', 'b4'], 40) });
      throw new Error('offline');
    });
    await expect(runOwnScan('chesscom', 'Me', fetchImpl)).resolves.toBe('error');
    const state = useProgressStore.getState();
    expect(state.ownDrills.length).toBeGreaterThanOrEqual(3);
    expect(state.scan.phase).toBe('error');
    expect(state.scan.found).toBe(state.ownDrills.length);
    expect(state.scan.incoming).toBe(false);
    expect(playUnlocked({ found: state.scan.found, incoming: false, failed: true })).toBe(true);
    expect(state.gameProfile).toBeNull();
    const saved = savedProgress();
    expect(saved.ownDrills.length).toBe(state.ownDrills.length);
    expect(saved.scan).toMatchObject({ phase: 'error', incoming: false });
  });

  it('finishes below three blunders without waiting for another', async () => {
    const month = 'https://api.chess.com/pub/player/me/games/2026/10';
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/archives')) return json({ archives: [month] });
      return json({ games: games(['a3'], 20) });
    });
    await expect(runOwnScan('chesscom', 'Me', fetchImpl)).resolves.toBe('done');
    const state = useProgressStore.getState();
    expect(state.ownDrills.length).toBeGreaterThan(0);
    expect(state.ownDrills.length).toBeLessThan(3);
    expect(state.scan).toMatchObject({
      phase: 'done',
      found: state.ownDrills.length,
      incoming: false,
    });
    expect(playUnlocked({ found: state.ownDrills.length, incoming: false, failed: false })).toBe(true);
    expect(playUnlocked({ found: state.ownDrills.length, incoming: true, failed: false })).toBe(false);
  });

  it('does not flush the puzzle list after every game, and a refresh keeps blunders already found', async () => {
    const writes: string[] = [];
    const setItem = vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      if (String(key) === 'jdb-progress-v1') writes.push(String(value));
      memory.set(String(key), String(value));
    });
    let updates = 0;
    const unsub = useProgressStore.subscribe((state, prev) => {
      if (state.ownDrills !== prev.ownDrills) updates += 1;
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = runOwnScan('chesscom', 'Me', async (url) => {
      if (String(url).endsWith('/archives')) return json({ archives: [older, newer] });
      if (String(url) === newer) {
        return json({ games: games(['a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4'], 40) });
      }
      await gate;
      throw new Error('offline');
    });
    try {
      await waitUntil(() => useProgressStore.getState().scan.games >= 8);
      await new Promise((resolve) => setTimeout(resolve, SCAN_PERSIST_INTERVAL_MS + 250));
      const played = useProgressStore.getState().scan.games;
      expect(played).toBeGreaterThanOrEqual(8);
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.length).toBeLessThan(played);
      expect(updates).toBeGreaterThanOrEqual(played);
      const mid = savedProgress();
      expect(mid.ownDrills.length).toBeGreaterThanOrEqual(3);
      expect(useProgressStore.getState().scan.phase).toBe('scanning');
      expect(useProgressStore.getState().ownDrills.length).toBe(mid.ownDrills.length);
    } finally {
      release();
      unsub();
      await pending.catch(() => undefined);
      setItem.mockRestore();
    }
    const state = useProgressStore.getState();
    expect(state.scan.phase).toBe('error');
    expect(savedProgress().ownDrills.length).toBe(state.ownDrills.length);
    expect(state.ownDrills.length).toBeGreaterThanOrEqual(3);
    const raw = memory.get('jdb-progress-v1');
    useProgressStore.setState({ ownDrills: [] });
    await new Promise((resolve) => setTimeout(resolve, 30));
    memory.set('jdb-progress-v1', raw ?? '');
    await useProgressStore.persist.rehydrate();
    expect(useProgressStore.getState().ownDrills).toHaveLength(state.ownDrills.length);
  });
});

function savedProgress(): { ownDrills: unknown[]; scan: { phase?: string; incoming?: boolean } } {
  const raw = memory.get('jdb-progress-v1');
  if (!raw) throw new Error('progress was not written');
  return JSON.parse(raw).state;
}

async function waitUntil(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for the scan');
}
