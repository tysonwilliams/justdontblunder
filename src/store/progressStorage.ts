import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** At most one storage write per interval while a scan is publishing games. */
export const SCAN_PERSIST_INTERVAL_MS = 1000;

type Stored = StorageValue<Record<string, unknown>>;

let coalescing = false;
let latest: { name: string; value: Stored } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastCommit = 0;
let chain: Promise<void> = Promise.resolve();

function commit(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const pending = latest;
  latest = null;
  if (!pending) return chain;
  lastCommit = Date.now();
  const json = JSON.stringify(pending.value);
  const write = () => Promise.resolve(AsyncStorage.setItem(pending.name, json)).then(() => undefined);
  chain = chain.then(write, write);
  return chain;
}

function schedule(): void {
  if (timer) return;
  const wait = SCAN_PERSIST_INTERVAL_MS - (Date.now() - lastCommit);
  if (wait <= 0) {
    void commit();
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    void commit();
  }, wait);
}

/**
 * Hold puzzle-list writes while games are still arriving.
 * The in-memory store updates immediately. Storage catches up on this interval,
 * and `endCoalescedPersist` flushes the latest list.
 */
export function beginCoalescedPersist(): void {
  coalescing = true;
}

export async function endCoalescedPersist(): Promise<void> {
  coalescing = false;
  try {
    await commit();
  } catch {
    // The puzzles are already in memory. The next change tries storage again.
  }
}

export function resetProgressPersistForTests(): void {
  coalescing = false;
  latest = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

export const progressStorage: PersistStorage<Record<string, unknown>> = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Stored;
      if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    latest = { name, value: value as Stored };
    if (!coalescing) return commit();
    schedule();
    return undefined;
  },
  removeItem: (name) => {
    latest = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return AsyncStorage.removeItem(name);
  },
};
