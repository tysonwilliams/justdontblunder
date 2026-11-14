import type { DrillPosition } from '@/src/logic/drills';
import {
  collectPublicDrills,
  IMPORT_GAME_LIMIT,
  ImportError,
  type GameFetch,
  type GameProfile,
  type GameSite,
} from '@/src/logic/gameImport';
import type { Sleep } from '@/src/logic/politeFetch';
import { foundLine, mergeScannedDrills, poolSummary, PUZZLE_POOL_SIZE } from '@/src/logic/puzzlePool';
import { isAbortError } from '@/src/logic/scanAbort';
import {
  emptyCursor,
  sameScan,
  SCAN_CONTINUING_MESSAGE,
  SCAN_LOOKING_MESSAGE,
  SCAN_PAUSED_MESSAGE,
  snapshotCursor,
  type ScanCursor,
} from '@/src/logic/scanCursor';
import { resetScanWorkerForTests } from '@/src/logic/scanWorkerClient';
import { beginCoalescedPersist, endCoalescedPersist, resetProgressPersistForTests } from '@/src/store/progressStorage';
import { useProgressStore, type ScanProgress } from '@/src/store/progress';

let running = false;
let generation = 0;
let active: AbortController | null = null;

export function ownScanRunning(): boolean {
  return running;
}

/** Stop the in-flight requests and the worker. Blunders already found stay. */
export function cancelOwnScan(): void {
  active?.abort();
}

/** Test isolation. A failed scan must not leave the next one blocked. */
export function resetOwnScanForTests(): void {
  generation += 1;
  active?.abort();
  active = null;
  running = false;
  resetScanWorkerForTests();
  resetProgressPersistForTests();
}

export type OwnScanHooks = {
  sleep?: Sleep;
  now?: () => number;
};

type ScanResult = 'done' | 'error' | 'paused' | 'scanning';

function publish(scan: ScanProgress, drills?: readonly DrillPosition[], profile?: GameProfile): void {
  useProgressStore.setState((state) => {
    const next: {
      scan: ScanProgress;
      ownDrills?: DrillPosition[];
      pastedIds?: string[];
      gameProfile?: GameProfile;
    } = { scan };
    if (drills) {
      const ownDrills = mergeScannedDrills(state.ownDrills, drills, state.pastedIds, PUZZLE_POOL_SIZE);
      next.ownDrills = ownDrills;
      const live = new Set(ownDrills.map((drill) => drill.id));
      if (state.pastedIds.some((id) => !live.has(id))) {
        next.pastedIds = state.pastedIds.filter((id) => live.has(id));
      }
    }
    if (profile) next.gameProfile = profile;
    return next;
  });
}

function keptDrills(pastedIds: readonly string[], ownDrills: readonly DrillPosition[]): DrillPosition[] {
  const pasted = new Set(pastedIds);
  return ownDrills.filter((drill) => !pasted.has(drill.id));
}

function quietCursor(cursor: ScanCursor): ScanCursor {
  return snapshotCursor({ ...cursor, resume: false });
}

/**
 * Scan public games into the saved puzzle list.
 * The same username continues from the saved cursor and keeps pasted games.
 * A saved username means the lookup finished.
 */
export async function runOwnScan(
  site: GameSite,
  username: string,
  fetchImpl?: GameFetch,
  hooks?: OwnScanHooks,
): Promise<ScanResult> {
  if (running) return 'scanning';
  const gen = generation;
  const controller = new AbortController();
  active = controller;
  running = true;
  const state = useProgressStore.getState();
  const savedCursor = state.scan.cursor;
  const continuing = sameScan(savedCursor, site, username);
  const cursor = continuing ? quietCursor(savedCursor) : emptyCursor(site, username);
  const kept = continuing ? keptDrills(state.pastedIds, state.ownDrills) : [];
  const gameLimit =
    continuing && !cursor.backfillDone ? Math.max(0, IMPORT_GAME_LIMIT - cursor.games) : IMPORT_GAME_LIMIT;
  let produced = kept.length > 0;
  beginCoalescedPersist();
  const live = () => gen === generation;
  try {
    if (live()) {
      useProgressStore.setState({
        scanPromptDismissed: false,
        scan: {
          phase: 'scanning',
          found: kept.length,
          games: cursor.games,
          incoming: true,
          message: continuing ? SCAN_CONTINUING_MESSAGE : SCAN_LOOKING_MESSAGE,
          cursor,
        },
      });
    }
    try {
      const scan = await collectPublicDrills(site, username, {
        fetchImpl,
        signal: controller.signal,
        cursor,
        kept,
        gameLimit,
        sleep: hooks?.sleep,
        now: hooks?.now,
        onStatus: (message) => {
          if (!live()) return;
          const current = useProgressStore.getState().scan;
          if (current.phase !== 'scanning') return;
          useProgressStore.getState().setScan({ ...current, message });
        },
        onProgress: (update) => {
          if (!live()) return;
          produced = true;
          publish(
            {
              phase: 'scanning',
              found: update.found,
              games: update.games,
              incoming: update.incoming,
              message: foundLine(update.found),
              cursor: quietCursor(update.cursor),
            },
            update.drills,
          );
        },
      });
      if (!live()) return 'paused';
      publish(
        {
          phase: 'done',
          found: scan.drills.length,
          games: scan.games,
          incoming: false,
          message: poolSummary(scan.drills.length),
          cursor: quietCursor(scan.cursor),
        },
        scan.drills,
        { site, username },
      );
      return 'done';
    } catch (error) {
      if (!live()) return 'paused';
      const now = useProgressStore.getState();
      const savedCursor = now.scan.cursor ? quietCursor(now.scan.cursor) : cursor;
      if (isAbortError(error)) {
        publish({
          phase: 'paused',
          found: produced ? now.scan.found : 0,
          games: now.scan.games,
          incoming: false,
          message: SCAN_PAUSED_MESSAGE,
          cursor: savedCursor,
        });
        return 'paused';
      }
      const message =
        error instanceof ImportError ? error.message : 'Could not reach the site. Paste a PGN from one game.';
      publish({
        phase: 'error',
        found: produced ? now.ownDrills.length : 0,
        games: produced ? now.scan.games : 0,
        incoming: false,
        message,
        cursor: savedCursor,
      });
      return 'error';
    }
  } finally {
    if (active === controller) active = null;
    try {
      await endCoalescedPersist();
    } finally {
      if (gen === generation) running = false;
    }
  }
}
