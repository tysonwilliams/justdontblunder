import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { useTrainerRound } from '@/src/components/trainer/useTrainerRound';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { usePuzzleGrowth } from '@/src/components/usePuzzleGrowth';
import {
  reviewForEntries,
  sessionForTheme,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import {
  isCorrectDrillMove,
  type DrillPosition,
  type DrillSession as DrillSessionData,
} from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine } from '@/src/logic/punishment';
import { coachForRound } from '@/src/logic/coach';
import { feedbackForRound, missFeedback } from '@/src/logic/saveFeedback';
import { buildPuzzlePool } from '@/src/logic/puzzlePool';
import { roundProgress, trainerBoard, type TrainerMove } from '@/src/logic/trainerRound';
import { applyRoundEffects } from '@/src/store/trainerResult';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

export type DrillPlayMode = 'play' | 'review';

export type DrillRunSummary = {
  saved: number;
  best: number;
  playedSan: string | null;
  missText: string;
  fen: string;
  lastMove: TrainerMove | null;
  orientation: 'white' | 'black';
  atRisk: Square;
};

function playedSan(fen: string, from: Square, to: Square): string | null {
  const moved = tryMove(createGame(fen), from, to);
  return moved?.san ?? null;
}

function solutionMove(drill: DrillPosition): { from: Square; to: Square; fen: string } | null {
  const uci = drill.solution[0];
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const game = createGame(drill.fen);
  const moved = tryMove(game, from, to);
  if (!moved) return null;
  return { from: moved.from, to: moved.to, fen: game.fen() };
}

function playingPool() {
  return buildPuzzlePool(useProgressStore.getState().ownDrills);
}

function reviewSession(theme: ThemeFilter) {
  return reviewForEntries(useProgressStore.getState().review, theme);
}

export function useDrillSession(mode: DrillPlayMode, theme: ThemeFilter, streak: boolean) {
  const { colors, scheme } = useTheme();
  const sudden = mode === 'play' && streak;
  const guided = !sudden;
  const reviewing = mode === 'review';
  const { state, dispatch } = useTrainerRound();

  const bestPuzzleStreak = useProgressStore((s) => s.bestPuzzleStreak);
  const hydrated = useHydrated(useProgressStore.persist);

  const [session, setSession] = useState<DrillSessionData>(() =>
    reviewing ? reviewSession(theme) : sessionForTheme(theme, playingPool()),
  );
  const [runSummary, setRunSummary] = useState<DrillRunSummary | null>(null);
  const reviewStarted = useRef(false);
  const started = useRef(false);
  const positionsRef = useRef<readonly DrillPosition[]>(session.positions);
  positionsRef.current = session.positions;

  const index = state.index;
  const round = state.phase;
  const drill: DrillPosition | undefined = session.positions[index];
  const puzzleId = drill?.id;
  const puzzleFen = drill?.fen;
  const done = index >= session.positions.length;
  const place = useRef({ index, round });
  place.current = { index, round };
  const latest = useRef({ drill, sudden, reviewing });
  latest.current = { drill, sudden, reviewing };

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const begin = (nextSession: DrillSessionData) => {
    started.current = true;
    dispatch({ type: 'begin' });
    setRunSummary(null);
    setSession(nextSession);
  };

  useEffect(() => {
    if (!reviewing) {
      reviewStarted.current = false;
      return;
    }
    if (!hydrated || reviewStarted.current) return;
    reviewStarted.current = true;
    begin(reviewSession(theme));
    // The screen remounts when the filter changes. begin reads the latest setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, hydrated, theme]);

  usePuzzleGrowth(
    !reviewing,
    hydrated,
    place,
    positionsRef,
    started,
    () => {
      const own = useProgressStore.getState().ownDrills;
      const personal = theme === 'all' ? own : own.filter((item) => item.theme === theme);
      return {
        personal,
        rebuilt: sessionForTheme(theme, buildPuzzlePool(own)).positions,
      };
    },
    (positions) => {
      setSession((prev) => ({ ...prev, positions }));
    },
  );

  useEffect(() => {
    if (!puzzleId || !puzzleFen) return;
    dispatch({ type: 'loadPuzzle', fen: puzzleFen });
  }, [puzzleId, puzzleFen, dispatch]);

  useEffect(() => {
    if (!sudden || !done) return;
    applyRoundEffects(dispatch({ type: 'finishRun' }).effects, undefined, false);
  }, [done, sudden, dispatch]);

  const restart = () => {
    begin(reviewing ? reviewSession(theme) : sessionForTheme(theme, playingPool()));
  };

  const next = () => {
    started.current = true;
    dispatch({ type: 'advance', length: session.positions.length, wrap: false });
  };

  const tryAgain = () => {
    const current = latest.current.drill;
    if (!current) return;
    dispatch({ type: 'tryAgain', fen: current.fen });
  };

  const revealIdea = () => {
    const current = latest.current.drill;
    if (!current) return;
    const result = dispatch({
      type: 'reveal',
      sudden: latest.current.sudden,
      move: solutionMove(current),
    });
    if (!result.accepted) return;
    started.current = true;
    applyRoundEffects(result.effects, current, latest.current.reviewing);
  };

  const onMove = useCallback(
    (event: BoardMoveEvent) => {
      const now = latest.current;
      const current = now.drill;
      if (!current) return false;
      const ok = isCorrectDrillMove(current, event.from, event.to);
      const result = dispatch({
        type: 'answer',
        correct: ok,
        afterFen: event.afterFen,
        move: { from: event.from, to: event.to },
        san: event.san,
        line: ok ? [] : punishmentLine(current, event.from, event.to),
        sudden: now.sudden,
        missText: ok ? '' : missFeedback(current, event.from, event.to),
      });
      if (!result.accepted) return false;
      started.current = true;
      applyRoundEffects(result.effects, current, now.reviewing);
      return ok;
    },
    [dispatch],
  );

  const replayActive = runSummary == null && (round === 'retry' || round === 'streakEnd');
  const playback = usePunishmentPlayback(replayActive, state.replayLine);
  const board = trainerBoard(playback, state, drill?.fen ?? '', replayActive);

  const showRunSummary = () => {
    const current = drill;
    if (!current) return;
    const stillOnMiss = round === 'streakEnd';
    const played =
      state.missedPlay?.san ??
      (state.lastMove ? playedSan(current.fen, state.lastMove.from, state.lastMove.to) : null);
    setRunSummary({
      saved: state.score.correct,
      best: Math.max(bestPuzzleStreak, state.score.correct),
      playedSan: played,
      missText:
        state.missedPlay?.text ??
        (!state.shownIdea && state.lastMove
          ? missFeedback(current, state.lastMove.from, state.lastMove.to)
          : current.note),
      fen: stillOnMiss ? board.fen : (state.missedPlay?.fen ?? current.fen),
      lastMove: stillOnMiss ? board.lastMove : (state.missedPlay?.lastMove ?? null),
      orientation: current.sideToMove === 'b' ? 'black' : 'white',
      atRisk: current.atRiskSquare,
    });
  };

  const progress = drill ? roundProgress(index, round, session.positions.length) : 0;
  const marks = useMemo(
    () =>
      drill
        ? highlightsForRound(round, state.lastMove, drill.atRiskSquare)
        : { squares: [] as Square[], tone: 'danger' as const },
    [drill, round, state.lastMove],
  );
  const taught = drill ? (feedbackForRound(round, drill, state.shownIdea ? null : state.lastMove) ?? '') : '';
  const coachKind = round === 'correct' ? 'save' : round === 'retry' || round === 'streakEnd' ? 'blunder' : 'idea';
  const roundCopy = drill
    ? coachForRound(coachKind, drill.fen, state.shownIdea ? null : state.lastMove, taught)
    : '';
  const threatFrom = !state.shownIdea ? playback.arrow?.from : undefined;
  const threatTo = !state.shownIdea ? playback.arrow?.to : undefined;
  const threatArrow = useMemo<BoardArrow[]>(() => {
    if (!threatFrom || !threatTo) return [];
    return [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }];
  }, [colors, scheme, threatFrom, threatTo]);
  const attentionSquares = useMemo(
    () => (guided && round === 'playing' && drill ? [drill.atRiskSquare] : []),
    [guided, round, drill],
  );

  return {
    guided,
    streak: sudden,
    reviewing,
    hydrated,
    runSummary,
    done,
    drill,
    session,
    index,
    round,
    score: state.score,
    orientation,
    boardFen: board.fen,
    boardLastMove: board.lastMove,
    progress,
    marks,
    roundCopy,
    threatArrow,
    attentionSquares,
    watchingReply: board.watchingReply,
    replyReady: board.replyReady,
    shownIdea: state.shownIdea,
    runOver: state.runOver,
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
