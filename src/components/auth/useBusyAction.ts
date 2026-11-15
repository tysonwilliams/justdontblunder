import { useCallback, useRef, useState } from 'react';

export function useBusyAction() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
