import { useEffect, useRef, type MutableRefObject } from 'react';

import type { DrillPosition } from '@/src/logic/drills';
import { nextSessionPositions, playUnlocked, samePositionIds } from '@/src/logic/earlyPlay';
import { useProgressStore } from '@/src/store/progress';

type Place = { index: number; round: string };

type Built = {
  personal: readonly DrillPosition[];
  rebuilt: readonly DrillPosition[];
};

/**
 * Keep a Home or Drills session in step with a username scan.
 * The current puzzle stays put once the player has started, or once play has unlocked.
 */
export function usePuzzleGrowth(
  enabled: boolean,
  hydrated: boolean,
  place: MutableRefObject<Place>,
  positions: MutableRefObject<readonly DrillPosition[]>,
  started: MutableRefObject<boolean>,
  build: () => Built,
  apply: (positions: DrillPosition[]) => void,
): void {
  const committed = useRef(false);
  const buildRef = useRef(build);
  const applyRef = useRef(apply);
  buildRef.current = build;
  applyRef.current = apply;
  const ownDrills = useProgressStore((state) => state.ownDrills);
  const phase = useProgressStore((state) => state.scan.phase);
  const found = useProgressStore((state) => state.scan.found);
  const incoming = useProgressStore((state) => state.scan.incoming);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const built = buildRef.current();
    const decision = nextSessionPositions({
      current: positions.current,
      personal: built.personal,
      rebuilt: built.rebuilt,
      index: place.current.index,
      engaged: started.current || place.current.index !== 0 || place.current.round !== 'playing',
      committed: committed.current,
      unlocked: playUnlocked({ found, incoming, failed: phase === 'error' }),
      scanning: phase === 'scanning',
    });
    committed.current = decision.committed;
    if (!decision.positions) return;
    if (samePositionIds(positions.current, decision.positions)) return;
    applyRef.current(decision.positions.slice());
  }, [enabled, found, hydrated, incoming, ownDrills, phase, place, positions, started]);
}
