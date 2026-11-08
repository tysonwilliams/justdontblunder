import { useEffect, useState } from 'react';

import { getEnginePhase, subscribeEnginePhase, warmEngine, type EnginePhase } from '@/src/engine/stockfish';

/** Starts the web engine on first use and reports when it can answer. */
export function useEnginePhase(): EnginePhase {
  const [phase, setPhase] = useState<EnginePhase>(() => {
    warmEngine();
    return getEnginePhase();
  });

  useEffect(() => {
    const unsubscribe = subscribeEnginePhase(() => setPhase(getEnginePhase()));
    setPhase(getEnginePhase());
    return unsubscribe;
  }, []);

  return phase;
}
