import { useEffect, useState } from 'react';

import { getEnginePhase, subscribeEnginePhase, warmEngine, type EnginePhase } from '@/src/engine/stockfish';

/** Starts the web engine after the first paint and reports when it can answer. */
export function useEnginePhase(): EnginePhase {
  const [phase, setPhase] = useState<EnginePhase>(() => getEnginePhase());

  useEffect(() => {
    const unsubscribe = subscribeEnginePhase(() => setPhase(getEnginePhase()));
    const timer = setTimeout(() => warmEngine(), 600);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return phase;
}
