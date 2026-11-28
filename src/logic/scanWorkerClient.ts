import type { Color } from 'chess.js';

import type { DrillPosition } from '@/src/logic/drills';
import { blundersInGameYielding, readPastedGame } from '@/src/logic/gameBlunders';
import { abortError, isAbortError, throwIfAborted } from '@/src/logic/scanAbort';
import type { ScanWorkerRequest, ScanWorkerResponse } from '@/src/logic/scanProtocol';

const GAME_TIMEOUT_MS = 20000;

type WorkerResult = {
  drills: DrillPosition[];
  readable?: boolean;
};

type Waiter = {
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Waiter>();

export function resetScanWorkerForTests(): void {
  workerBroken = false;
  nextId = 1;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  const error = new Error('reset');
  for (const waiter of pending.values()) waiter.reject(error);
  pending.clear();
}

export function scanWorkerSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function openScanWorker(): Worker {
  // Metro bundles this worker only when the constructor is written literally.
  return new Worker(new URL('./scanWorker', window.location.href));
}

function failWorker(error: Error): void {
  workerBroken = true;
  const current = worker;
  worker = null;
  current?.terminate();
  for (const waiter of pending.values()) waiter.reject(error);
  pending.clear();
}

/** Stop the current job. The next game can open a fresh worker. */
function stopWorker(error: Error): void {
  const current = worker;
  worker = null;
  current?.terminate();
  for (const waiter of pending.values()) waiter.reject(error);
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const created = openScanWorker();
  created.onmessage = (event: MessageEvent<ScanWorkerResponse>) => {
    const message = event.data;
    if (!message || typeof message.id !== 'number') return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error || !Array.isArray(message.drills)) {
      waiter.reject(new Error(message.error ?? 'bad worker response'));
      return;
    }
    waiter.resolve({ drills: message.drills, readable: message.readable });
  };
  created.onerror = () => {
    failWorker(new Error('Blunder scan worker failed'));
  };
  worker = created;
  return created;
}

function askWorker(
  pgn: string,
  userColor: Color,
  signal: AbortSignal | undefined,
  paste: boolean,
): Promise<WorkerResult> {
  throwIfAborted(signal);
  const id = nextId;
  nextId += 1;
  const engine = ensureWorker();
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error, result?: WorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      pending.delete(id);
      if (error) reject(error);
      else resolve(result ?? { drills: [] });
    };
    const onAbort = () => {
      pending.delete(id);
      stopWorker(abortError());
      settle(abortError());
    };
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      failWorker(new Error('Blunder scan worker timed out'));
    }, GAME_TIMEOUT_MS);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    pending.set(id, {
      resolve: (result) => settle(undefined, result),
      reject: (error) => settle(error),
    });
    const request: ScanWorkerRequest = paste ? { id, pgn, userColor, paste: true } : { id, pgn, userColor };
    engine.postMessage(request);
  });
}

/**
 * Replay one game away from the UI thread.
 * A missing or failed worker yields between moves instead, and keeps the same blunders.
 * An aborted signal stops the worker instead of falling back onto the main thread.
 */
export async function analyzeGame(pgn: string, userColor: Color, signal?: AbortSignal): Promise<DrillPosition[]> {
  throwIfAborted(signal);
  if (!workerBroken && scanWorkerSupported()) {
    try {
      const result = await askWorker(pgn, userColor, signal, false);
      return result.drills;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw abortError();
      return blundersInGameYielding(pgn, userColor, undefined, signal);
    }
  }
  return blundersInGameYielding(pgn, userColor, undefined, signal);
}

/** Paste analysis uses the scan worker so a long PGN does not freeze the board. */
export async function analyzePastedPgn(
  pgn: string,
  userColor: Color,
  signal?: AbortSignal,
): Promise<{ readable: boolean; drills: DrillPosition[] }> {
  const trimmed = pgn.trim();
  if (!trimmed) return { readable: false, drills: [] };
  throwIfAborted(signal);
  if (!workerBroken && scanWorkerSupported()) {
    try {
      const result = await askWorker(trimmed, userColor, signal, true);
      return { readable: result.readable === true, drills: result.drills };
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw abortError();
    }
  }
  return readPastedGame(trimmed, userColor);
}
