import type { StateCreator } from 'zustand';

import { cursorFromSaved, SCAN_PAUSED_MESSAGE, snapshotCursor } from '@/src/logic/scanCursor';
import type { ProgressState, ScanProgress } from '@/src/store/progressTypes';

export type ScanData = {
  scan: ScanProgress;
  scanPromptDismissed: boolean;
};

type ScanSlice = ScanData & Pick<ProgressState, 'setScan' | 'dismissScanPrompt'>;

export function idleScan(): ScanProgress {
  return { phase: 'idle', found: 0, games: 0, message: '', incoming: false, cursor: null };
}

export function initialScan(): ScanData {
  return { scan: idleScan(), scanPromptDismissed: false };
}

/**
 * A scan saved while it was running becomes paused and keeps its cursor.
 * Opening the app continues that one. A scan the player stopped stays paused
 * until they start it again. An older document has no cursor, so a running
 * scan there still drops back to idle.
 */
export function scanFromSaved(value: unknown): ScanProgress {
  if (!value || typeof value !== 'object') return idleScan();
  const scan = value as Partial<ScanProgress>;
  const found = finite(scan.found);
  const games = finite(scan.games);
  const message = typeof scan.message === 'string' ? scan.message : '';
  const cursor = cursorFromSaved(scan.cursor);
  if (scan.phase === 'scanning' || scan.phase === 'paused') {
    if (!cursor) return idleScan();
    const resume = scan.phase === 'scanning';
    return {
      phase: 'paused',
      found,
      games,
      message: resume ? SCAN_PAUSED_MESSAGE : message || SCAN_PAUSED_MESSAGE,
      incoming: false,
      cursor: snapshotCursor({ ...cursor, resume }),
    };
  }
  if (scan.phase !== 'done' && scan.phase !== 'error' && scan.phase !== 'idle') return idleScan();
  return {
    phase: scan.phase,
    found,
    games,
    message,
    incoming: false,
    cursor: cursor ? snapshotCursor({ ...cursor, resume: false }) : null,
  };
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export const createScanSlice: StateCreator<ProgressState, [], [], ScanSlice> = (set) => ({
  ...initialScan(),
  setScan: (scan) => set({ scan }),
  dismissScanPrompt: () => set({ scanPromptDismissed: true }),
});
