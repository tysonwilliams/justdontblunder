import type { DrillPosition } from '@/src/logic/drills';
import { collectPublicDrills, ImportError, type GameFetch, type GameProfile, type GameSite } from '@/src/logic/gameImport';
import { resetScanWorkerForTests } from '@/src/logic/scanWorkerClient';
import { foundLine, mergeScannedDrills, poolSummary, PUZZLE_POOL_SIZE } from '@/src/logic/puzzlePool';
import { beginCoalescedPersist, endCoalescedPersist, resetProgressPersistForTests } from '@/src/store/progressStorage';
import { useProgressStore, type ScanProgress } from '@/src/store/progress';

let running = false;

export function ownScanRunning(): boolean {
  return running;
}

/** Test isolation. A failed scan must not leave the next one blocked. */
export function resetOwnScanForTests(): void {
  running = false;
  resetScanWorkerForTests();
  resetProgressPersistForTests();
}

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

/** Scan public games into the saved puzzle list. A saved username means the lookup finished. */
export async function runOwnScan(
  site: GameSite,
  username: string,
  fetchImpl?: GameFetch,
): Promise<'done' | 'error'> {
  if (running) {
    const current = useProgressStore.getState().scan;
    useProgressStore.getState().setScan({
      phase: 'error',
      found: current.found,
      games: current.games,
      incoming: current.incoming,
      message: 'Already looking through games.',
    });
    return 'error';
  }
  running = true;
  let produced = false;
  beginCoalescedPersist();
  try {
    useProgressStore.setState({
      scanPromptDismissed: false,
      scan: {
        phase: 'scanning',
        found: 0,
        games: 0,
        incoming: true,
        message: 'Looking at recent games.',
      },
    });
    try {
      const scan = await collectPublicDrills(site, username, {
        fetchImpl,
        onProgress: (update) => {
          produced = true;
          publish(
            {
              phase: 'scanning',
              found: update.found,
              games: update.games,
              incoming: update.incoming,
              message: foundLine(update.found),
            },
            update.drills,
          );
        },
      });
      publish(
        {
          phase: 'done',
          found: scan.drills.length,
          games: scan.games,
          incoming: false,
          message: poolSummary(scan.drills.length),
        },
        scan.drills,
        { site, username },
      );
      return 'done';
    } catch (error) {
      const state = useProgressStore.getState();
      const message =
        error instanceof ImportError ? error.message : 'Could not reach the site. Paste a PGN from one game.';
      publish({
        phase: 'error',
        found: produced ? state.ownDrills.length : 0,
        games: produced ? state.scan.games : 0,
        incoming: false,
        message,
      });
      return 'error';
    }
  } finally {
    try {
      await endCoalescedPersist();
    } finally {
      running = false;
    }
  }
}
