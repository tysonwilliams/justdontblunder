import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import {
  reviewForTheme,
  sessionForTheme,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import {
  isCorrectDrillMove,
  type DrillPosition,
  type DrillSession as DrillSessionData,
} from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { coachForRound } from '@/src/logic/coach';
import { feedbackForRound, missFeedback } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { missesForDate, useProgressStore } from '@/src/store/progress';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

export type DrillPlayMode = 'streak' | 'play' | 'review';
type RoundState = 'playing' | 'correct' | 'retry' | 'revealed' | 'streakEnd';

export type DrillRunSummary = {
  saved: number;
  best: number;
  playedSan: string | null;
  missText: string;
  fen: string;
  lastMove: { from: Square; to: Square } | null;
  orientation: 'white' | 'black';
  atRisk: Square;
};

type MissedPlay = {
  san: string | null;
  text: string;
  fen: string;
  lastMove: { from: Square; to: Square };
};

function playedSan(fen: string, from: Square, to: Square): string | null {
  const moved = tryMove(createGame(fen), from, to);
  return moved?.san ?? null;
}

export function useDrillSession(mode: DrillPlayMode, theme: ThemeFilter) {
  const { colors, scheme } = useTheme();
  const guided = mode === 'play' || mode === 'review';
  const reviewing = mode === 'review';

  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);
  const clearMiss = useProgressStore((s) => s.clearMiss);
  const recordPuzzleRun = useProgressStore((s) => s.recordPuzzleRun);
  const bestPuzzleStreak = useProgressStore((s) => s.bestPuzzleStreak);
  const missedDate = useProgressStore((s) => s.missedDate);
  const missedIds = useProgressStore((s) => s.missedIds);

  const [session, setSession] = useState<DrillSessionData>(() =>
    reviewing
      ? reviewForTheme(
          missesForDate(useProgressStore.getState().missedDate, useProgressStore.getState().missedIds),
          theme,
        )
      : sessionForTheme(theme),
  );
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [runSummary, setRunSummary] = useState<DrillRunSummary | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [shownIdea, setShownIdea] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const [runOver, setRunOver] = useState(false);
  const [missedPlay, setMissedPlay] = useState<MissedPlay | null>(null);
  const reviewStarted = useRef(false);
  const runRecorded = useRef(false);
  const resultCounted = useRef(false);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;
  const replayActive = runSummary == null && (round === 'retry' || round === 'streakEnd');
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const latest = useRef({
    drill,
    round,
    runOver,
    mode,
    score,
    reviewing,
    shownIdea,
    lastMove,
    displayFen,
    bestPuzzleStreak,
    missedPlay,
  });
  latest.current = {
    drill,
    round,
    runOver,
    mode,
    score,
    reviewing,
    shownIdea,
    lastMove,
    displayFen,
    bestPuzzleStreak,
    missedPlay,
  };

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const resetBoard = () => {
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setShownIdea(false);
    setReplayLine([]);
  };

  const begin = (nextSession: DrillSessionData) => {
    runRecorded.current = false;
    resultCounted.current = false;
    setRunOver(false);
    setMissedPlay(null);
    setRunSummary(null);
    setSession(nextSession);
    setIndex(0);
    setScore({ correct: 0, total: 0 });
    resetBoard();
  };

  useEffect(() => {
    const unsub = useProgressStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProgressStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!reviewing) {
      reviewStarted.current = false;
      return;
    }
    if (!hydrated || reviewStarted.current) return;
    reviewStarted.current = true;
    begin(reviewForTheme(missesForDate(missedDate, missedIds), theme));
    // begin reads the latest setters. The screen remounts when the filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, hydrated, missedDate, missedIds, theme]);

  useEffect(() => {
    if (!drill) return;
    resultCounted.current = false;
    setDisplayFen(drill.fen);
    setRound('playing');
    setLastMove(null);
    setReplayLine([]);
  }, [drill?.id, drill?.fen]);

  useEffect(() => {
    if (mode !== 'streak' || !done || runRecorded.current) return;
    runRecorded.current = true;
    recordPuzzleRun(score.correct);
  }, [done, mode, recordPuzzleRun, score.correct]);

  const restart = () => {
    begin(reviewing ? reviewForTheme(missesForDate(missedDate, missedIds), theme) : sessionForTheme(theme));
  };

  const next = () => {
    setIndex((i) => i + 1);
  };

  const tryAgain = () => {
    const current = latest.current.drill;
    if (!current) return;
    setReplayLine([]);
    setDisplayFen(current.fen);
    setLastMove(null);
    setRound('playing');
  };

  /** Persist and score each puzzle once, on its first outcome. */
  const recordFirstResult = (correct: boolean) => {
    const current = latest.current.drill;
    if (!current) return;
    const claim = claimDrillResult(resultCounted.current);
    resultCounted.current = claim.claimed;
    if (!claim.recorded) return;
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    markDrillResult(correct, current.theme);
    if (correct) {
      if (latest.current.reviewing) clearMiss(current.id);
    } else {
      recordMiss(current.id);
    }
  };

  const revealIdea = () => {
    const current = latest.current.drill;
    if (!current) return;
    setShownIdea(true);
    recordFirstResult(false);
    const uci = current.solution[0];
    if (uci && uci.length >= 4) {
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const game = createGame(current.fen);
      const moved = tryMove(game, from, to);
      if (moved) {
        setDisplayFen(game.fen());
        setLastMove({ from: moved.from, to: moved.to });
      }
    }
    if (latest.current.mode === 'streak') {
      if (!runRecorded.current) {
        runRecorded.current = true;
        recordPuzzleRun(latest.current.score.correct);
      }
      setRound('streakEnd');
      return;
    }
    setRound('revealed');
  };

  const onMove = useCallback((event: BoardMoveEvent) => {
    const now = latest.current;
    const current = now.drill;
    if (!current || now.round !== 'playing') return false;

    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });

    const ok = isCorrectDrillMove(current, event.from, event.to);
    if (ok) {
      if (!now.runOver) recordFirstResult(true);
      setReplayLine([]);
      setRound('correct');
      return true;
    }
    setReplayLine(punishmentLine(current, event.from, event.to));
    if (now.mode === 'streak') {
      if (!now.runOver) {
        recordFirstResult(false);
        setMissedPlay({
          san: event.san,
          text: missFeedback(current, event.from, event.to),
          fen: event.afterFen,
          lastMove: { from: event.from, to: event.to },
        });
        if (!runRecorded.current) {
          runRecorded.current = true;
          recordPuzzleRun(now.score.correct);
        }
        setRunOver(true);
      }
      setRound('streakEnd');
    } else {
      recordFirstResult(false);
      setRound('retry');
    }
    return false;
  }, []);

  const showRunSummary = () => {
    const now = latest.current;
    const current = now.drill;
    if (!current) return;
    const stillOnMiss = now.round === 'streakEnd';
    const played =
      now.missedPlay?.san ?? (now.lastMove ? playedSan(current.fen, now.lastMove.from, now.lastMove.to) : null);
    setRunSummary({
      saved: now.score.correct,
      best: Math.max(now.bestPuzzleStreak, now.score.correct),
      playedSan: played,
      missText:
        now.missedPlay?.text ??
        (!now.shownIdea && now.lastMove ? missFeedback(current, now.lastMove.from, now.lastMove.to) : current.note),
      fen: stillOnMiss ? (playback.fen ?? now.displayFen ?? current.fen) : (now.missedPlay?.fen ?? current.fen),
      lastMove: stillOnMiss ? (playback.move ?? now.lastMove) : (now.missedPlay?.lastMove ?? null),
      orientation: current.sideToMove === 'b' ? 'black' : 'white',
      atRisk: current.atRiskSquare,
    });
  };

  const replyReady = !replayActive || playback.done;
  const boardFen = playback.fen ?? displayFen ?? drill?.fen ?? '';
  const boardLastMove = playback.move ?? lastMove;
  const progress = drill ? (index + (round === 'playing' ? 0 : 1)) / session.positions.length : 0;
  const marks = useMemo(
    () => (drill ? highlightsForRound(round, lastMove, drill.atRiskSquare) : { squares: [] as Square[], tone: 'danger' as const }),
    [drill, round, lastMove],
  );
  const taught = drill ? (feedbackForRound(round, drill, shownIdea ? null : lastMove) ?? '') : '';
  const coachKind = round === 'correct' ? 'save' : round === 'retry' || round === 'streakEnd' ? 'blunder' : 'idea';
  const roundCopy = drill ? coachForRound(coachKind, drill.fen, shownIdea ? null : lastMove, taught) : '';
  const threatFrom = !shownIdea ? playback.arrow?.from : undefined;
  const threatTo = !shownIdea ? playback.arrow?.to : undefined;
  const threatArrow = useMemo<BoardArrow[]>(() => {
    if (!threatFrom || !threatTo) return [];
    return [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }];
  }, [colors, scheme, threatFrom, threatTo]);
  const attentionSquares = useMemo(
    () => (guided && round === 'playing' && drill ? [drill.atRiskSquare] : []),
    [guided, round, drill],
  );
  const watchingReply = replayActive && !playback.done;

  return {
    guided,
    reviewing,
    hydrated,
    runSummary,
    done,
    drill,
    session,
    index,
    round,
    score,
    orientation,
    boardFen,
    boardLastMove,
    progress,
    marks,
    roundCopy,
    threatArrow,
    attentionSquares,
    watchingReply,
    replyReady,
    shownIdea,
    runOver,
    bestPuzzleStreak,
    onMove,
    revealIdea,
    tryAgain,
    next,
    restart,
    showRunSummary,
    begin,
    theme,
    mode,
  };
}
