import type { StateCreator } from 'zustand';

import type { ProgressState, ScanProgress } from '@/src/store/progressTypes';

export type ScanData = {
  scan: ScanProgress;
  scanPromptDismissed: boolean;
};

type ScanSlice = ScanData & Pick<ProgressState, 'setScan' | 'dismissScanPrompt'>;

export function idleScan(): ScanProgress {
  return { phase: 'idle', found: 0, games: 0, message: '', incoming: false };
}

export function initialScan(): ScanData {
  return { scan: idleScan(), scanPromptDismissed: false };
}

/** A refresh does not resume a scan. Done and error stay so the last result can show. */
export function scanFromSaved(value: unknown): ScanProgress {
  if (!value || typeof value !== 'object') return idleScan();
  const scan = value as Partial<ScanProgress>;
  if (scan.phase !== 'done' && scan.phase !== 'error' && scan.phase !== 'idle') return idleScan();
  return {
    phase: scan.phase,
    found: typeof scan.found === 'number' && Number.isFinite(scan.found) ? scan.found : 0,
    games: typeof scan.games === 'number' && Number.isFinite(scan.games) ? scan.games : 0,
    message: typeof scan.message === 'string' ? scan.message : '',
    incoming: false,
  };
}

export const createScanSlice: StateCreator<ProgressState, [], [], ScanSlice> = (set) => ({
  ...initialScan(),
  setScan: (scan) => set({ scan }),
  dismissScanPrompt: () => set({ scanPromptDismissed: true }),
});
