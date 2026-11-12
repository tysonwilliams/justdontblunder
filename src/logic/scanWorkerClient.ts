import type { Color } from 'chess.js';

import { blundersInGameYielding } from '@/src/logic/gameBlunders';
import type { DrillPosition } from '@/src/logic/drills';
import type { ScanWorkerRequest, ScanWorkerResponse } from '@/src/logic/scanProtocol';

const GAME_TIMEOUT_MS = 20000;

type Waiter = {
  resolve: (drills: DrillPosition[]) => void;
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
    waiter.resolve(message.drills);
  };
  created.onerror = () => {
    failWorker(new Error('Blunder scan worker failed'));
  };
  worker = created;
  return created;
}

function askWorker(pgn: string, userColor: Color): Promise<DrillPosition[]> {
  const id = nextId;
  nextId += 1;
  const engine = ensureWorker();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      workerBroken = true;
      reject(new Error('Blunder scan worker timed out'));
    }, GAME_TIMEOUT_MS);
    pending.set(id, {
      resolve: (drills) => {
        clearTimeout(timer);
        resolve(drills);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    const request: ScanWorkerRequest = { id, pgn, userColor };
    engine.postMessage(request);
  });
}

/**
 * Replay one game away from the UI thread.
 * A missing or failed worker yields between moves instead, and keeps the same blunders.
 */
export async function analyzeGame(pgn: string, userColor: Color): Promise<DrillPosition[]> {
  if (!workerBroken && scanWorkerSupported()) {
    try {
      return await askWorker(pgn, userColor);
    } catch {
      return blundersInGameYielding(pgn, userColor);
    }
  }
  return blundersInGameYielding(pgn, userColor);
}
