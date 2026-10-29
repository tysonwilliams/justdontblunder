/**
 * Platform-aware Stockfish evaluation service.
 * Web: stockfish.js lite single-thread WASM via Worker (no COOP/COEP).
 * Native / tests: stub until a native module is wired.
 */

export type EvalResult = {
  score: number;
  bestMove: string;
  pv: string[];
  depth: number;
  mate: number | null;
};

export type BlunderCheck = {
  isBlunder: boolean;
  severity: 'ok' | 'inaccuracy' | 'mistake' | 'blunder';
  dropCp: number;
};

type EngineAdapter = {
  evaluate: (fen: string, depth?: number) => Promise<EvalResult>;
  terminate: () => void;
};

let adapterPromise: Promise<EngineAdapter> | null = null;

function parseInfoScore(line: string): { score: number; mate: number | null } | null {
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (mateMatch) {
    const mate = Number(mateMatch[1]);
    return { score: mate > 0 ? 100000 - mate : -100000 - mate, mate };
  }
  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  if (cpMatch) {
    return { score: Number(cpMatch[1]), mate: null };
  }
  return null;
}

function createWorkerAdapter(scriptUrl: string): EngineAdapter {
  let worker: Worker | null = null;
  const listeners = new Set<(msg: string) => void>();
  let ready: Promise<void> | null = null;

  const ensure = async () => {
    if (worker && ready) {
      await ready;
      return worker;
    }
    worker = new Worker(scriptUrl);
    worker.onmessage = (e: MessageEvent) => {
      const msg = typeof e.data === 'string' ? e.data : String(e.data);
      listeners.forEach((listener) => listener(msg));
    };
    ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Stockfish init timeout')), 10000);
      const handler = (msg: string) => {
        if (msg === 'uciok') worker?.postMessage('isready');
        if (msg === 'readyok') {
          clearTimeout(timeout);
          listeners.delete(handler);
          resolve();
        }
      };
      listeners.add(handler);
      worker?.postMessage('uci');
    });
    await ready;
    return worker;
  };

  return {
    async evaluate(fen, depth = 12) {
      const eng = await ensure();
      return new Promise<EvalResult>((resolve, reject) => {
        let score = 0;
        let mate: number | null = null;
        let pv: string[] = [];
        let seenDepth = 0;

        const timeout = setTimeout(() => {
          listeners.delete(handler);
          reject(new Error('Stockfish evaluation timed out'));
        }, 12000);

        const handler = (msg: string) => {
          if (msg.startsWith('info')) {
            const parsed = parseInfoScore(msg);
            if (parsed) {
              score = parsed.score;
              mate = parsed.mate;
            }
            const depthMatch = msg.match(/\bdepth (\d+)/);
            if (depthMatch) seenDepth = Number(depthMatch[1]);
            const pvMatch = msg.match(/\bpv (.+)$/);
            if (pvMatch) pv = pvMatch[1].trim().split(/\s+/);
          }
          if (msg.startsWith('bestmove')) {
            clearTimeout(timeout);
            listeners.delete(handler);
            const bestMove = msg.split(/\s+/)[1] ?? '';
            resolve({
              score,
              bestMove: bestMove === '(none)' ? '' : bestMove,
              pv,
              depth: seenDepth || depth,
              mate,
            });
          }
        };

        listeners.add(handler);
        eng.postMessage('ucinewgame');
        eng.postMessage(`position fen ${fen}`);
        eng.postMessage(`go depth ${depth}`);
      });
    },
    terminate() {
      worker?.terminate();
      worker = null;
      ready = null;
      listeners.clear();
    },
  };
}

function createStubAdapter(): EngineAdapter {
  return {
    async evaluate() {
      return { score: 0, bestMove: '', pv: [], depth: 0, mate: null };
    },
    terminate() {},
  };
}

function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

async function getAdapter(): Promise<EngineAdapter> {
  if (!adapterPromise) {
    adapterPromise = Promise.resolve(
      isWebRuntime()
        ? createWorkerAdapter('/stockfish-19-lite-single.js')
        : createStubAdapter(),
    );
  }
  return adapterPromise;
}

export async function evaluate(fen: string, depth = 12): Promise<EvalResult> {
  try {
    const adapter = await getAdapter();
    return await adapter.evaluate(fen, depth);
  } catch {
    return { score: 0, bestMove: '', pv: [], depth: 0, mate: null };
  }
}

/**
 * Compare the position after the user's move to the pre-move best eval.
 * Scores should be from the moving side's perspective
 * (positive = good for the side that just moved).
 */
export function isBlunder(
  userMoveScore: number,
  bestScore: number,
  threshold = 150,
): BlunderCheck {
  const dropCp = bestScore - userMoveScore;
  if (dropCp < 50) {
    return { isBlunder: false, severity: 'ok', dropCp: Math.max(0, dropCp) };
  }
  if (dropCp < 100) {
    return { isBlunder: false, severity: 'inaccuracy', dropCp };
  }
  if (dropCp < threshold) {
    return { isBlunder: true, severity: 'mistake', dropCp };
  }
  return { isBlunder: true, severity: 'blunder', dropCp };
}

export function terminateEngine(): void {
  void getAdapter().then((adapter) => adapter.terminate());
  adapterPromise = null;
}
