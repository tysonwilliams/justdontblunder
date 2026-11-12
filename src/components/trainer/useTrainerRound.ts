import { useCallback, useRef, useState } from 'react';

import {
  initialTrainerRound,
  stepTrainerRound,
  type TrainerAction,
  type TrainerRoundState,
  type TrainerStep,
} from '@/src/logic/trainerRound';

export function useTrainerRound(): {
  state: TrainerRoundState;
  dispatch: (action: TrainerAction) => TrainerStep;
} {
  const [state, setState] = useState(initialTrainerRound);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: TrainerAction) => {
    const next = stepTrainerRound(stateRef.current, action);
    stateRef.current = next.state;
    setState(next.state);
    return next;
  }, []);

  return { state, dispatch };
}
