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
let persistIntervalMs = SCAN_PERSIST_INTERVAL_MS;
/** Bumped when a device erase drops a scan batch that was already queued. */
let writeEpoch = 0;

function commit(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const pending = latest;
  const epoch = writeEpoch;
  latest = null;
  if (!pending) return chain;
  lastCommit = Date.now();
  const json = JSON.stringify(pending.value);
  const write = () => {
    if (epoch !== writeEpoch) return undefined;
    return Promise.resolve(AsyncStorage.setItem(pending.name, json)).then(() => undefined);
  };
  chain = chain.then(write, write);
  return chain;
}

function schedule(): void {
  if (timer) return;
  const wait = persistIntervalMs - (Date.now() - lastCommit);
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

/** Tests widen this so a slow run still counts as one batch, not one write per game. */
export function setScanPersistIntervalForTests(ms: number): void {
  persistIntervalMs = ms;
}

/** Write the latest scan state without ending the batch. */
export async function flushCoalescedPersistForTests(): Promise<void> {
  await commit();
}

export function resetProgressPersistForTests(): void {
  coalescing = false;
  latest = null;
  persistIntervalMs = SCAN_PERSIST_INTERVAL_MS;
  if (timer) clearTimeout(timer);
  timer = null;
}

/**
 * Drop a scan batch that has not landed yet.
 * A write already queued sees the new epoch and does not store the old cursor.
 */
export function discardPendingProgressWrites(): void {
  writeEpoch += 1;
  coalescing = false;
  latest = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Remove the progress document after any write that was already queued. */
export async function removePersistedProgress(name: string): Promise<void> {
  latest = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const remove = () => Promise.resolve(AsyncStorage.removeItem(name)).then(() => undefined);
  chain = chain.then(remove, remove);
  await chain;
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
