import { useCallback, useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import { soundForSan } from '@/src/audio/moveSound';
import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { playFeedback } from '@/src/feedback/playFeedback';
import type { PunishmentStep } from '@/src/logic/punishment';

export const PUNISHMENT_STEP_MS = 720;

type Playback = {
  /** Position after the latest punishment ply. Null while the student's move is still on the board. */
  fen: string | null;
  move: { from: Square; to: Square } | null;
  /** Attacker → victim for the ply just shown, or the ply about to be played. */
  arrow: { from: Square; to: Square } | null;
  done: boolean;
  /** Jump straight to the final punishment ply. */
  skip: () => void;
  /** Re-run the punishment animation from the student's blunder. */
  replay: () => void;
};

/**
 * Steps through a punishment line: threat arrow first, then each reply.
 * `line` should be state owned by the caller so the timer is not restarted every render.
 */
export function usePunishmentPlayback(active: boolean, line: PunishmentStep[]): Playback {
  const reduced = useReducedMotion();
  const [runId, setRunId] = useState(0);
  const baseKey = active ? line.map((step) => `${step.from}${step.to}${step.fen}`).join('|') : '';
  const replayKey = baseKey ? `${baseKey}#${runId}` : '';
  const [trackedBase, setTrackedBase] = useState(baseKey);
  const [trackedKey, setTrackedKey] = useState(replayKey);
  const [step, setStep] = useState(-1);
  const [finishedOnce, setFinishedOnce] = useState(false);

  if (trackedBase !== baseKey) {
    setTrackedBase(baseKey);
    setFinishedOnce(false);
  }
  if (trackedKey !== replayKey) {
    setTrackedKey(replayKey);
    setStep(reduced && line.length > 0 ? line.length - 1 : -1);
  }
  const cursor = trackedKey === replayKey ? step : reduced && line.length > 0 ? line.length - 1 : -1;
  const completedBefore = trackedBase === baseKey && finishedOnce;

  const lineRef = useRef(line);
  lineRef.current = line;

  useEffect(() => {
    if (!active || lineRef.current.length === 0) return;
    if (reduced) {
      const last = lineRef.current[lineRef.current.length - 1];
      setStep(lineRef.current.length - 1);
      setFinishedOnce(true);
      if (last) playFeedback(soundForSan(last.san));
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = (next: number) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        const move = lineRef.current[next];
        if (!move) return;
        setStep(next);
        if (next + 1 < lineRef.current.length) {
          kick(next + 1);
        } else {
          setFinishedOnce(true);
        }
        playFeedback(soundForSan(move.san));
      }, PUNISHMENT_STEP_MS);
    };
    kick(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, replayKey, reduced]);

  const replay = useCallback(() => {
    if (lineRef.current.length === 0) return;
    setRunId((n) => n + 1);
  }, []);

  const skip = useCallback(() => {
    if (lineRef.current.length === 0) return;
    setStep(lineRef.current.length - 1);
    setFinishedOnce(true);
  }, []);

  const done = active && (line.length === 0 || cursor >= line.length - 1 || completedBefore);
  const shown = cursor >= 0 ? line[cursor] : null;
  const arrowStep =
    !active || line.length === 0 ? null : cursor + 1 < line.length ? line[cursor + 1] : line[cursor];

  return {
    fen: shown?.fen ?? null,
    move: shown ? { from: shown.from, to: shown.to } : null,
    arrow: arrowStep ? { from: arrowStep.from, to: arrowStep.to } : null,
    done,
    skip,
    replay,
  };
}
