import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import {
  createHomeSession,
  homePlayPrompt,
  isCorrectDrillMove,
  type DrillPosition,
} from '@/src/logic/drills';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { learnCard } from '@/src/logic/lessons';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { colors } from '@/src/theme';

export type HomeRound = 'playing' | 'correct' | 'retry';
export type HomeEntryId = 'learn' | 'drills' | 'practice';

export function homeEntryHref(id: HomeEntryId, learnHref: string): string {
  switch (id) {
    case 'learn':
      return learnHref;
    case 'drills':
      return '/drills';
    case 'practice':
      return '/practice';
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function homeResultCard(round: HomeRound): { title: string; tone: 'success' | 'danger' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Nice save', tone: 'success' };
    case 'retry':
      return { title: 'Blunder', tone: 'danger' };
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

export function useHomeTrainer() {
  const [session] = useState(() => createHomeSession());
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<HomeRound>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());
  const resultCounted = useRef(false);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;

  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);
  const streak = useProgressStore((s) => s.dailyStreak);
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const learn = hydrated
    ? learnCard(completedLessons)
    : { href: '/learn', title: 'Learn', body: 'Six short lessons on blunders.' };

  const drill: DrillPosition | undefined = session.positions[index];
  const total = session.positions.length;
  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );
  const latest = useRef({ drill, round });
  latest.current = { drill, round };

  useEffect(() => {
    const unsub = useProgressStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProgressStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsub();
    };
  }, []);

  const next = () => {
    if (total === 0) return;
    resultCounted.current = false;
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setReplayLine([]);
    setIndex((i) => (i + 1) % total);
    setBoardKey((k) => k + 1);
  };

  const tryAgain = () => {
    setReplayLine([]);
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setBoardKey((k) => k + 1);
  };

  const recordFirstResult = (correct: boolean) => {
    const current = latest.current.drill;
    if (!current) return;
    const claim = claimDrillResult(resultCounted.current);
    resultCounted.current = claim.claimed;
    if (!claim.recorded) return;
    markDrillResult(correct, current.theme);
    if (!correct) recordMiss(current.id);
  };

  const onMove = useCallback((event: BoardMoveEvent) => {
    const current = latest.current.drill;
    if (!current || latest.current.round !== 'playing') return false;
    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    const ok = isCorrectDrillMove(current, event.from, event.to);
    recordFirstResult(ok);
    if (ok) setReplayLine([]);
    else setReplayLine(punishmentLine(current, event.from, event.to));
    setRound(ok ? 'correct' : 'retry');
    return ok;
  }, []);

  const boardFen = playback.fen ?? displayFen ?? drill?.fen ?? '';
  const boardLastMove = playback.move ?? lastMove;
  const progress = drill ? (index + (round === 'playing' ? 0 : 1)) / total : 0;
  const marks = useMemo(
    () => (drill ? highlightsForRound(round, lastMove, drill.atRiskSquare) : { squares: [] as Square[], tone: 'danger' as const }),
    [drill, round, lastMove],
  );
  const card = homeResultCard(round);
  const roundCopy = drill ? (feedbackForRound(round, drill, lastMove) ?? '') : '';
  const threatFrom = playback.arrow?.from;
  const threatTo = playback.arrow?.to;
  const threatArrow = useMemo<BoardArrow[]>(() => {
    if (!threatFrom || !threatTo) return [];
    return [{ from: threatFrom, to: threatTo, color: colors.danger }];
  }, [threatFrom, threatTo]);
  const attentionSquares = useMemo(
    () => (round === 'playing' && drill ? [drill.atRiskSquare] : []),
    [round, drill],
  );
  const prompt = drill ? homePlayPrompt(drill) : '';

  return {
    drill,
    total,
    index,
    round,
    hydrated,
    streak,
    learn,
    orientation,
    boardKey,
    boardFen,
    boardLastMove,
    progress,
    marks,
    card,
    roundCopy,
    threatArrow,
    attentionSquares,
    prompt,
    replyReady,
    watchingReply: replayActive && !playback.done,
    onMove,
    next,
    tryAgain,
  };
}
