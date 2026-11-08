import { useEffect, useState } from 'react';

type PersistApi = {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
};

/** True once a persisted store has finished reading storage. */
export function useHydrated(persist: PersistApi): boolean {
  const [ready, setReady] = useState(() => persist.hasHydrated());

  useEffect(() => {
    if (persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return persist.onFinishHydration(() => setReady(true));
  }, [persist]);

  return ready;
}
