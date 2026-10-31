import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import type { PunishmentStep } from '@/src/logic/punishment';

export const PUNISHMENT_STEP_MS = 720;

type Playback = {
  /** Position after the latest punishment ply. Null while the student's move is still on the board. */
  fen: string | null;
  move: { from: Square; to: Square } | null;
  /** Attacker → victim for the ply just shown, or the ply about to be played. */
  arrow: { from: Square; to: Square } | null;
  done: boolean;
};

/**
 * Steps through a punishment line: threat arrow first, then each reply.
 * `line` should be state owned by the caller so the timer is not restarted every render.
 */
export function usePunishmentPlayback(active: boolean, line: PunishmentStep[]): Playback {
  const replayKey = active ? line.map((step) => `${step.from}${step.to}${step.fen}`).join('|') : '';
  const [trackedKey, setTrackedKey] = useState(replayKey);
  const [step, setStep] = useState(-1);
  if (trackedKey !== replayKey) {
    setTrackedKey(replayKey);
    setStep(-1);
  }
  const cursor = trackedKey === replayKey ? step : -1;

  const lineRef = useRef(line);
  lineRef.current = line;

  useEffect(() => {
    if (!active || lineRef.current.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = (next: number) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        const move = lineRef.current[next];
        if (!move) return;
        setStep(next);
        if (next + 1 < lineRef.current.length) kick(next + 1);
        playMoveSound(soundForSan(move.san));
      }, PUNISHMENT_STEP_MS);
    };
    kick(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, replayKey]);

  const done = active && (line.length === 0 || cursor >= line.length - 1);
  const shown = cursor >= 0 ? line[cursor] : null;
  const arrowStep =
    !active || line.length === 0 ? null : cursor + 1 < line.length ? line[cursor + 1] : line[cursor];

  return {
    fen: shown?.fen ?? null,
    move: shown ? { from: shown.from, to: shown.to } : null,
    arrow: arrowStep ? { from: arrowStep.from, to: arrowStep.to } : null,
    done,
  };
}
