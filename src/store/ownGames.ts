import { collectPublicDrills, ImportError, type GameFetch, type GameSite } from '@/src/logic/gameImport';
import { foundLine, poolSummary } from '@/src/logic/puzzlePool';
import { useProgressStore } from '@/src/store/progress';

let running = false;

export function ownScanRunning(): boolean {
  return running;
}

/** Test isolation. A failed scan must not leave the next one blocked. */
export function resetOwnScanForTests(): void {
  running = false;
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
  useProgressStore.setState({ scanPromptDismissed: false });
  useProgressStore.getState().setScan({
    phase: 'scanning',
    found: 0,
    games: 0,
    incoming: true,
    message: 'Looking at recent games.',
  });
  try {
    const scan = await collectPublicDrills(site, username, {
      fetchImpl,
      onProgress: (update) => {
        produced = true;
        useProgressStore.getState().saveImportedDrills(update.drills);
        useProgressStore.getState().setScan({
          phase: 'scanning',
          found: update.found,
          games: update.games,
          incoming: update.incoming,
          message: foundLine(update.found),
        });
      },
    });
    useProgressStore.getState().saveImportedDrills(scan.drills);
    useProgressStore.getState().saveGameProfile({ site, username });
    useProgressStore.getState().setScan({
      phase: 'done',
      found: scan.drills.length,
      games: scan.games,
      incoming: false,
      message: poolSummary(scan.drills.length),
    });
    return 'done';
  } catch (error) {
    const state = useProgressStore.getState();
    const message =
      error instanceof ImportError ? error.message : 'Could not reach the site. Paste a PGN from one game.';
    useProgressStore.getState().setScan({
      phase: 'error',
      found: produced ? state.ownDrills.length : 0,
      games: produced ? state.scan.games : 0,
      incoming: false,
      message,
    });
    return 'error';
  } finally {
    running = false;
  }
}
