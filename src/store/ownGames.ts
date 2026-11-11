import { collectPublicDrills, ImportError, type GameSite } from '@/src/logic/gameImport';
import { foundLine, poolSummary } from '@/src/logic/puzzlePool';
import { useProgressStore } from '@/src/store/progress';

let running = false;

export function ownScanRunning(): boolean {
  return running;
}

/** Scan public games into the saved puzzle list. A saved username means the lookup finished. */
export async function runOwnScan(site: GameSite, username: string): Promise<'done' | 'error'> {
  if (running) {
    useProgressStore.getState().setScan({
      phase: 'error',
      found: useProgressStore.getState().scan.found,
      games: useProgressStore.getState().scan.games,
      message: 'Already looking through games.',
    });
    return 'error';
  }
  running = true;
  useProgressStore.getState().setScan({
    phase: 'scanning',
    found: 0,
    games: 0,
    message: 'Looking at recent games.',
  });
  try {
    const scan = await collectPublicDrills(site, username, {
      onProgress: (update) => {
        useProgressStore.getState().saveImportedDrills(update.drills);
        useProgressStore.getState().setScan({
          phase: 'scanning',
          found: update.found,
          games: update.games,
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
      message: poolSummary(scan.drills.length),
    });
    return 'done';
  } catch (error) {
    const message =
      error instanceof ImportError ? error.message : 'Could not reach the site. Paste a PGN from one game.';
    useProgressStore.getState().setScan({
      phase: 'error',
      found: useProgressStore.getState().ownDrills.length,
      games: 0,
      message,
    });
    return 'error';
  } finally {
    running = false;
  }
}
