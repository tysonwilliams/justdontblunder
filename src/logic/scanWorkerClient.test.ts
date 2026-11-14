import { Chess } from 'chess.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readPastedGame } from '@/src/logic/gameBlunders';
import { abortError } from '@/src/logic/scanAbort';
import type { ScanWorkerRequest, ScanWorkerResponse } from '@/src/logic/scanProtocol';
import { handleScanMessage } from '@/src/logic/scanWorker';
import { analyzeGame, analyzePastedPgn, resetScanWorkerForTests } from '@/src/logic/scanWorkerClient';

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

describe('scan worker client', () => {
  afterEach(() => {
    resetScanWorkerForTests();
    vi.unstubAllGlobals();
  });

  it('reads a pasted PGN in the worker, not on the caller', async () => {
    const requests: ScanWorkerRequest[] = [];
    class FakeWorker {
      onmessage: ((event: { data: ScanWorkerResponse }) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(data: ScanWorkerRequest) {
        requests.push(data);
        const response = handleScanMessage(data);
        queueMicrotask(() => {
          this.onmessage?.({ data: response });
        });
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('window', { location: { href: 'http://localhost/app' } });

    const pgn = queenHang('c3');
    const result = await analyzePastedPgn(pgn, 'w');
    expect(requests[0]?.paste).toBe(true);
    expect(result).toEqual(readPastedGame(pgn, 'w'));
    expect(result.drills.length).toBeGreaterThan(0);

    const blank = await analyzePastedPgn('hello', 'w');
    expect(blank).toEqual({ readable: false, drills: [] });
    expect(requests.at(-1)?.paste).toBe(true);
    expect(handleScanMessage({ id: 3, pgn: 'hello', userColor: 'w', paste: true })).toEqual({
      id: 3,
      drills: [],
      readable: false,
    });
  });

  it('terminates the worker when the signal aborts', async () => {
    let terminated = 0;
    class FakeWorker {
      onmessage: ((event: { data: ScanWorkerResponse }) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {}
      terminate() {
        terminated += 1;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('window', { location: { href: 'http://localhost/app' } });
    const controller = new AbortController();
    const pending = analyzeGame(queenHang('a3'), 'w', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(terminated).toBe(1);
    expect(abortError().name).toBe('AbortError');
  });

  it('stops a main-thread replay when the worker is unavailable', async () => {
    const controller = new AbortController();
    const pending = analyzeGame(queenHang('a3'), 'w', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
