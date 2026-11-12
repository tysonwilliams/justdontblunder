import { blundersInGame } from '@/src/logic/gameBlunders';
import type { ScanWorkerRequest, ScanWorkerResponse } from '@/src/logic/scanProtocol';

/** One game in, the same blunders `blundersInGame` would return on the UI thread. */
export function handleScanMessage(data: ScanWorkerRequest): ScanWorkerResponse {
  if (
    !data ||
    typeof data.id !== 'number' ||
    typeof data.pgn !== 'string' ||
    (data.userColor !== 'w' && data.userColor !== 'b')
  ) {
    return { id: typeof data?.id === 'number' ? data.id : 0, drills: [], error: 'bad request' };
  }
  try {
    return { id: data.id, drills: blundersInGame(data.pgn, data.userColor) };
  } catch (error) {
    return {
      id: data.id,
      drills: [],
      error: error instanceof Error ? error.message : 'scan failed',
    };
  }
}

function installScanWorker(): void {
  const scope = globalThis as typeof globalThis & {
    postMessage?: (message: ScanWorkerResponse) => void;
    onmessage: ((event: MessageEvent<ScanWorkerRequest>) => void) | null;
  };
  // The window can see this constructor too. Only the worker is an instance of it.
  const ctor = (globalThis as Record<string, unknown>).DedicatedWorkerGlobalScope;
  if (typeof ctor !== 'function' || !(scope instanceof ctor)) return;
  if (typeof scope.postMessage !== 'function') return;
  const post = scope.postMessage.bind(scope);
  scope.onmessage = (event) => {
    post(handleScanMessage(event.data));
  };
}

installScanWorker();
