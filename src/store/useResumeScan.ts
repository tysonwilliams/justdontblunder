import { useEffect, useRef } from 'react';

import { runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';

/**
 * Continue a scan that was saved while it was still running.
 * A scan the player stopped waits until they start it again.
 */
export function useResumeScan(): void {
  const hydrated = useHydrated(useProgressStore.persist);
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || started.current) return;
    const scan = useProgressStore.getState().scan;
    const cursor = scan.cursor;
    if (!cursor?.resume || scan.phase === 'scanning') return;
    started.current = true;
    void runOwnScan(cursor.site, cursor.username);
  }, [hydrated]);
}
