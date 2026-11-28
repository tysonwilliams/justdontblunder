import { useEffect, useState } from 'react';
import type { Square } from 'chess.js';

import { useReducedMotion } from '@/src/components/Board/useReducedMotion';

const TRIGGER_DELAY_MS = 220;

/**
 * Briefly displays `setupFen` and then transitions to `fen` with `triggerMove`
 * so the board slides the opponent's triggering move into place as each puzzle opens.
 */
export function useTriggerAnimation(
  puzzleKey: string,
  fen: string,
  setupFen: string | undefined,
  triggerMove: { from: Square; to: Square } | undefined,
  active: boolean,
): { fen: string; lastMove: { from: Square; to: Square } | null; animating: boolean } {
  const reduced = useReducedMotion();
  const canAnimate = active && !reduced && Boolean(setupFen && triggerMove && setupFen !== fen);
  const [settledKey, setSettledKey] = useState<string>(() => (canAnimate ? '' : puzzleKey));

  useEffect(() => {
    if (!canAnimate) {
      setSettledKey(puzzleKey);
      return;
    }
    const timer = setTimeout(() => {
      setSettledKey(puzzleKey);
    }, TRIGGER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canAnimate, puzzleKey]);

  const animating = canAnimate && settledKey !== puzzleKey;
  if (animating && setupFen) {
    return { fen: setupFen, lastMove: null, animating: true };
  }
  return {
    fen,
    lastMove: active && triggerMove ? triggerMove : null,
    animating: false,
  };
}
