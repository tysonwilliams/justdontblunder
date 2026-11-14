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
import { pastedGameDrills } from '@/src/logic/gameImport';
import { abortError } from '@/src/logic/scanAbort';
import { PROGRESS_VERSION } from '@/src/store/progressMigrate';
import { cancelOwnScan, resetOwnScanForTests, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { flushCoalescedPersistForTests, setScanPersistIntervalForTests } from '@/src/store/progressStorage';

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
      pastedIds: [],
      gameProfile: null,
      scanPromptDismissed: false,
      scan: { phase: 'idle', found: 0, games: 0, message: '', incoming: false, cursor: null },
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
    await expect(runOwnScan('chesscom', 'Me', fetchImpl, { sleep: async () => {} })).resolves.toBe('error');
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
    setScanPersistIntervalForTests(60_000);
    const pending = runOwnScan(
      'chesscom',
      'Me',
      async (url) => {
        if (String(url).endsWith('/archives')) return json({ archives: [older, newer] });
        if (String(url) === newer) {
          return json({ games: games(['a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4'], 40) });
        }
        await gate;
        throw new Error('offline');
      },
      { sleep: async () => {} },
    );
    try {
      await waitUntil(() => useProgressStore.getState().scan.games >= 8);
      await flushCoalescedPersistForTests();
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

  it('keeps pasted games when a username scan publishes', async () => {
    const pasted = pastedGameDrills(queenHang('h3'), 'w');
    expect(pasted.readable).toBe(true);
    expect(pasted.drills.length).toBeGreaterThan(0);
    useProgressStore.getState().mergeImportedDrills(pasted.drills);
    const pastedIds = pasted.drills.map((drill) => drill.id);
    expect(useProgressStore.getState().pastedIds).toEqual(pastedIds);
    const stray = { ...pasted.drills[0]!, id: 'own-not-pasted' };
    useProgressStore.setState({
      ownDrills: [...useProgressStore.getState().ownDrills, stray],
    });

    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/archives')) return json({ archives: [older, newer] });
      if (String(url) === newer) return json({ games: games(['a3', 'a4', 'b3'], 30) });
      return json({ games: games(['c3'], 10) });
    });
    await expect(runOwnScan('chesscom', 'Me', fetchImpl)).resolves.toBe('done');

    const ids = useProgressStore.getState().ownDrills.map((drill) => drill.id);
    for (const id of pastedIds) expect(ids).toContain(id);
    expect(ids).not.toContain('own-not-pasted');
    expect(ids.length).toBeGreaterThan(pastedIds.length);

    const saved = savedProgress();
    expect(saved.pastedIds).toEqual(pastedIds);
    const raw = memory.get('jdb-progress-v1');
    useProgressStore.setState({ ownDrills: [], pastedIds: [] });
    await new Promise((resolve) => setTimeout(resolve, 30));
    memory.set('jdb-progress-v1', raw ?? '');
    await useProgressStore.persist.rehydrate();
    const restored = useProgressStore.getState().ownDrills.map((drill) => drill.id);
    for (const id of pastedIds) expect(restored).toContain(id);
    expect(restored).not.toContain('own-not-pasted');
    expect(useProgressStore.getState().pastedIds).toEqual(pastedIds);
  });

  it('stops an in-flight request and keeps a paused cursor', async () => {
    const calls: string[] = [];
    const pending = runOwnScan('chesscom', 'Me', (url, init) => {
      const href = String(url);
      calls.push(href);
      if (href.endsWith('/archives')) return Promise.resolve(json({ archives: [older, newer] }));
      if (href === newer) {
        return new Promise((_resolve, reject) => {
          const onAbort = () => reject(abortError());
          if (init?.signal?.aborted) {
            onAbort();
            return;
          }
          init?.signal?.addEventListener('abort', onAbort, { once: true });
        });
      }
      return Promise.resolve(json({ games: games(['c3'], 10) }));
    });
    try {
      await waitUntil(() => calls.includes(newer));
      cancelOwnScan();
      await expect(pending).resolves.toBe('paused');
    } finally {
      cancelOwnScan();
      await pending.catch(() => undefined);
    }
    expect(calls).not.toContain(older);
    const scan = useProgressStore.getState().scan;
    expect(scan.phase).toBe('paused');
    expect(scan.incoming).toBe(false);
    expect(scan.cursor?.resume).toBe(false);
    expect(scan.message).toBe('Scan paused.');
    await flushCoalescedPersistForTests();
    const raw = memory.get('jdb-progress-v1');
    useProgressStore.setState({
      ownDrills: [],
      scan: { phase: 'idle', found: 0, games: 0, message: '', incoming: false, cursor: null },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    memory.set('jdb-progress-v1', raw ?? '');
    await useProgressStore.persist.rehydrate();
    expect(useProgressStore.getState().scan.phase).toBe('paused');
    expect(useProgressStore.getState().scan.cursor?.resume).toBe(false);
  });

  it('stops the scan worker when the player cancels', async () => {
    let terminated = 0;
    let posted!: () => void;
    const postedWait = new Promise<void>((resolve) => {
      posted = resolve;
    });
    class FakeWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {
        posted();
      }
      terminate() {
        terminated += 1;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('window', { location: { href: 'http://localhost/app' } });
    const pending = runOwnScan('chesscom', 'Me', async (url) => {
      if (String(url).endsWith('/archives')) return json({ archives: [older] });
      return json({ games: games(['a3'], 20) });
    });
    try {
      await postedWait;
      cancelOwnScan();
      await expect(pending).resolves.toBe('paused');
      expect(terminated).toBeGreaterThan(0);
    } finally {
      cancelOwnScan();
      await pending.catch(() => undefined);
      vi.unstubAllGlobals();
      resetOwnScanForTests();
    }
  });

  it('resumes after a reload without refetching a month already finished', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = runOwnScan(
      'chesscom',
      'Me',
      async (url) => {
        const href = String(url);
        if (href.endsWith('/archives')) return json({ archives: [older, newer] });
        if (href === newer) return json({ games: games(['a3', 'a4', 'b3'], 30) });
        await gate;
        throw abortError();
      },
      { sleep: async () => {} },
    );
    let raw = '';
    try {
      await waitUntil(() => (useProgressStore.getState().scan.cursor?.doneArchives ?? []).includes(newer));
      await flushCoalescedPersistForTests();
      raw = memory.get('jdb-progress-v1') ?? '';
      expect(useProgressStore.getState().scan.games).toBeGreaterThanOrEqual(3);
      cancelOwnScan();
      release();
      await first;
    } finally {
      release();
      await first.catch(() => undefined);
    }
    expect(useProgressStore.getState().scan.phase).toBe('paused');
    expect(useProgressStore.getState().ownDrills.length).toBeGreaterThanOrEqual(3);
    const found = useProgressStore.getState().ownDrills.length;

    useProgressStore.setState({
      ownDrills: [],
      pastedIds: [],
      gameProfile: null,
      scan: { phase: 'idle', found: 0, games: 0, message: '', incoming: false, cursor: null },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    memory.set('jdb-progress-v1', raw);
    await useProgressStore.persist.rehydrate();
    const restored = useProgressStore.getState();
    expect(restored.scan.phase).toBe('paused');
    expect(restored.scan.cursor?.resume).toBe(true);
    expect(restored.scan.cursor?.doneArchives).toContain(newer);
    expect(restored.ownDrills).toHaveLength(found);
    expect(
      restored.ownDrills.some((drill) => drill.source?.move === 'Qh5' && drill.source.gameId.startsWith('c:')),
    ).toBe(true);

    const calls: string[] = [];
    await runOwnScan('chesscom', 'Me', async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.endsWith('/archives')) return json({ archives: [older, newer] });
      if (href === newer) throw new Error('refetched a finished month');
      return json({ games: games(['c3', 'c4'], 10) });
    });
    expect(calls).not.toContain(newer);
    expect(calls).toContain(older);
    expect(useProgressStore.getState().ownDrills.length).toBeGreaterThan(found);
    expect(useProgressStore.getState().scan.phase).toBe('done');
    expect(useProgressStore.getState().scan.cursor?.resume).toBe(false);
    expect(useProgressStore.getState().gameProfile).toEqual({ site: 'chesscom', username: 'Me' });
  });

  it('rescans only new games and keeps pasted drills', async () => {
    const pasted = pastedGameDrills(queenHang('h3'), 'w');
    expect(pasted.readable).toBe(true);
    useProgressStore.getState().mergeImportedDrills(pasted.drills);
    const pastedIds = pasted.drills.map((drill) => drill.id);

    await runOwnScan('chesscom', 'Me', async (url) => {
      const href = String(url);
      if (href.endsWith('/archives')) return json({ archives: [older, newer] });
      if (href === newer) return json({ games: games(['a3', 'a4'], 30) });
      return json({ games: games(['b3'], 10) });
    });
    const firstIds = useProgressStore.getState().ownDrills.map((drill) => drill.id);
    for (const id of pastedIds) expect(firstIds).toContain(id);
    expect(useProgressStore.getState().scan.cursor?.backfillDone).toBe(true);

    const calls: string[] = [];
    await runOwnScan('chesscom', 'Me', async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.endsWith('/archives')) return json({ archives: [older, newer] });
      if (href === newer) {
        return json({
          games: [
            ...games(['a3', 'a4'], 30),
            {
              pgn: queenHang('g3'),
              time_class: 'rapid',
              end_time: 80,
              white: { username: 'Me' },
              black: { username: 'them' },
            },
          ],
        });
      }
      throw new Error(`refetched ${href}`);
    });
    expect(calls.filter((href) => href === older)).toHaveLength(0);
    expect(calls).toContain(newer);
    const after = useProgressStore.getState().ownDrills;
    const ids = after.map((drill) => drill.id);
    for (const id of firstIds) expect(ids).toContain(id);
    expect(after.some((drill) => drill.source?.gameId.includes(':80:'))).toBe(true);
    expect(useProgressStore.getState().scan.phase).toBe('done');
  });

  it('waits out a 429 and tells the player instead of failing', async () => {
    const waits: number[] = [];
    const messages: string[] = [];
    const unsub = useProgressStore.subscribe((state, prev) => {
      if (state.scan.message !== prev.scan.message) messages.push(state.scan.message);
    });
    let tries = 0;
    try {
      await runOwnScan(
        'chesscom',
        'Me',
        async (url) => {
          const href = String(url);
          if (href.endsWith('/archives')) {
            tries += 1;
            if (tries === 1) {
              return {
                ok: false,
                status: 429,
                headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '3' : null) },
                json: async () => ({}),
                text: async () => '',
              };
            }
            return json({ archives: [older] });
          }
          return json({ games: games(['a3'], 20) });
        },
        {
          sleep: async (ms) => {
            waits.push(ms);
          },
        },
      );
    } finally {
      unsub();
    }
    expect(waits).toEqual([3000]);
    expect(messages).toContain('Chess.com is busy. Trying again.');
    expect(useProgressStore.getState().scan.phase).toBe('done');
    expect(useProgressStore.getState().ownDrills.length).toBeGreaterThan(0);
  });
});

function savedProgress(): {
  ownDrills: unknown[];
  pastedIds?: string[];
  scan: { phase?: string; incoming?: boolean };
} {
  const raw = memory.get('jdb-progress-v1');
  if (!raw) throw new Error('progress was not written');
  const parsed = JSON.parse(raw) as {
    version?: number;
    state: {
      library?: { ownDrills?: unknown[]; pastedIds?: string[] };
      scan?: { phase?: string; incoming?: boolean };
    };
  };
  if (parsed.version !== PROGRESS_VERSION || !parsed.state.library) {
    throw new Error('progress blob was not the sliced document');
  }
  return {
    ownDrills: parsed.state.library.ownDrills ?? [],
    pastedIds: parsed.state.library.pastedIds,
    scan: parsed.state.scan ?? {},
  };
}

async function waitUntil(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for the scan');
}
