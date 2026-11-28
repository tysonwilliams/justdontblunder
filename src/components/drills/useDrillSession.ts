import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { useTriggerAnimation } from '@/src/components/drills/useTriggerAnimation';
import { useTrainerRound } from '@/src/components/trainer/useTrainerRound';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { usePuzzleGrowth } from '@/src/components/usePuzzleGrowth';
import { openStreakRun, publishStreakScore } from '@/src/data/leaderboard';
import {
  reviewForEntries,
  sessionForTheme,
  upcomingReviewCount,
  type DrillSourceFilter,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { difficultyLabel, drillDifficulty, threatAttackerArrow } from '@/src/logic/difficulty';
import {
  isCorrectDrillMove,
  personalSourceLabel,
  type DrillPosition,
  type DrillSession as DrillSessionData,
} from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine } from '@/src/logic/punishment';
import { clubTacticalWarning } from '@/src/logic/safety';
import { missFeedback, roundSpeech } from '@/src/logic/saveFeedback';
import { buildPoolForTheme, orderPoolWithOwnFirst } from '@/src/logic/puzzlePool';
import { formatReviewGap, nextReviewGapDays } from '@/src/logic/reviewSchedule';
import { shownBest, streakScoreInRange } from '@/src/logic/streak';
import { roundProgress, trainerBoard, type TrainerMove } from '@/src/logic/trainerRound';
import { useDrillPrefs } from '@/src/store/drillPrefs';
import { applyRoundEffects } from '@/src/store/trainerResult';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

export type DrillPlayMode = 'play' | 'review';
export const BLITZ_SECONDS = 15;

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
  const promo = uci.length >= 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
  const game = createGame(drill.fen);
  const moved = tryMove(game, from, to, promo);
  if (!moved) return null;
  return { from: moved.from, to: moved.to, fen: game.fen() };
}

function playingPool(
  theme: ThemeFilter,
  source: DrillSourceFilter,
  sudden: boolean,
  restartCount: number,
): DrillPosition[] {
  const { ownDrills, drillsCompleted } = useProgressStore.getState();
  const seed = sudden
    ? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff) ^ (restartCount * 2654435761)) >>> 0
    : undefined;
  return orderPoolWithOwnFirst(ownDrills, theme, {
    ownOnly: source === 'own',
    sudden,
    seed,
    restartCount,
    drillsCompleted,
  });
}

function reviewSession(theme: ThemeFilter, includeAhead = false) {
  return reviewForEntries(useProgressStore.getState().review, theme, undefined, { includeAhead });
}

export function useDrillSession(
  mode: DrillPlayMode,
  theme: ThemeFilter,
  streak: boolean,
  source: DrillSourceFilter = 'all',
) {
  const { colors, scheme } = useTheme();
  const experience = useProgressStore((s) => s.experience);
  const sudden = mode === 'play' && streak;
  const unpromptedOverride = useDrillPrefs((s) => s.unprompted);
  const setUnpromptedOverride = useDrillPrefs((s) => s.setUnprompted);
  const blitzTimer = useDrillPrefs((s) => s.blitzTimer);
  const setBlitzTimer = useDrillPrefs((s) => s.setBlitzTimer);
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_SECONDS);
  const [hintStep, setHintStep] = useState(0);
  const restartCount = useRef(0);

  const unprompted = unpromptedOverride ?? experience === 'intermediate';
  const guided = !sudden && !unprompted;
  const reviewing = mode === 'review';
  const { state, dispatch } = useTrainerRound();

  const bestPuzzleStreak = useProgressStore((s) => s.bestPuzzleStreak);
  const reviewEntries = useProgressStore((s) => s.review);
  const hydrated = useHydrated(useProgressStore.persist);

  const [practicingAhead, setPracticingAhead] = useState(false);
  const [nextGapLabel, setNextGapLabel] = useState<string | null>(null);
  const [nextGapShort, setNextGapShort] = useState<string | null>(null);
  const [session, setSession] = useState<DrillSessionData>(() =>
    reviewing ? reviewSession(theme, false) : sessionForTheme(theme, playingPool(theme, source, sudden, 0)),
  );
  const [runSummary, setRunSummary] = useState<DrillRunSummary | null>(null);
  const reviewStarted = useRef(false);
  const started = useRef(false);
  const postedRun = useRef<string | null>(null);
  const requeuedIds = useRef<Set<string>>(new Set());
  const requeuedSlots = useRef<Set<number>>(new Set());
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
  const latest = useRef({ drill, sudden, reviewing, practicingAhead, index });
  latest.current = { drill, sudden, reviewing, practicingAhead, index };

  const upcomingCount = useMemo(
    () => (reviewing ? upcomingReviewCount(reviewEntries, theme) : 0),
    [reviewing, reviewEntries, theme],
  );
  const reviewEntry = useMemo(
    () => (reviewing && drill ? (reviewEntries.find((entry) => entry.id === drill.id) ?? null) : null),
    [reviewing, drill, reviewEntries],
  );
  const sourceLabel = useMemo(() => (drill ? personalSourceLabel(drill) : null), [drill]);
  const sourceUrl = drill?.source?.url ?? null;
  const difficulty = useMemo(() => (drill ? difficultyLabel(drillDifficulty(drill)) : null), [drill]);

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const begin = (nextSession: DrillSessionData, ahead = false) => {
    started.current = true;
    requeuedIds.current = new Set();
    requeuedSlots.current = new Set();
    setPracticingAhead(ahead);
    setNextGapLabel(null);
    setNextGapShort(null);
    setHintStep(0);
    setSecondsLeft(BLITZ_SECONDS);
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
    begin(reviewSession(theme, false), false);
    // The screen remounts when the filter changes. begin reads the latest setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, hydrated, theme]);

  usePuzzleGrowth(
    !reviewing && !sudden,
    hydrated,
    place,
    positionsRef,
    started,
    () => {
      const own = useProgressStore.getState().ownDrills;
      const personal = theme === 'all' ? own : own.filter((item) => item.theme === theme);
      return {
        personal,
        rebuilt: sessionForTheme(
          theme,
          buildPoolForTheme(own, theme, undefined, { ownOnly: source === 'own' }),
        ).positions,
      };
    },
    (positions) => {
      setSession((prev) => ({ ...prev, positions }));
    },
  );

  useEffect(() => {
    if (!puzzleId || !puzzleFen) return;
    setNextGapLabel(null);
    setNextGapShort(null);
    setHintStep(0);
    setSecondsLeft(BLITZ_SECONDS);
    dispatch({ type: 'loadPuzzle', fen: puzzleFen });
  }, [puzzleId, puzzleFen, index, dispatch]);

  useEffect(() => {
    if (!blitzTimer || done || round !== 'playing') return;
    setSecondsLeft(BLITZ_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [blitzTimer, done, round, puzzleId, index]);

  useEffect(() => {
    if (!sudden || !done) return;
    applyRoundEffects(dispatch({ type: 'finishRun' }).effects, undefined, false);
  }, [done, sudden, dispatch]);

  useEffect(() => {
    if (!sudden) return;
    void openStreakRun();
  }, [sudden, session.startedAt]);

  useEffect(() => {
    if (!sudden || !state.runRecorded) return;
    const length = state.score.correct;
    const key = `${session.startedAt}:${length}`;
    if (postedRun.current === key) return;
    postedRun.current = key;
    if (!streakScoreInRange(length)) return;
    void publishStreakScore(length);
  }, [sudden, state.runRecorded, state.score.correct, session.startedAt]);

  const restart = () => {
    restartCount.current += 1;
    begin(
      reviewing
        ? reviewSession(theme, false)
        : sessionForTheme(theme, playingPool(theme, source, sudden, restartCount.current)),
      false,
    );
  };

  const practiceAhead = () => {
    begin(reviewSession(theme, true), true);
  };

  const next = () => {
    started.current = true;
    setNextGapLabel(null);
    setNextGapShort(null);
    setHintStep(0);
    setSecondsLeft(BLITZ_SECONDS);
    dispatch({ type: 'advance', length: session.positions.length, wrap: false });
  };

  const tryAgain = () => {
    const current = latest.current.drill;
    if (!current) return;
    setNextGapLabel(null);
    setNextGapShort(null);
    setSecondsLeft(BLITZ_SECONDS);
    dispatch({ type: 'tryAgain', fen: current.fen });
  };

  const requeueIfNeeded = (current: DrillPosition) => {
    if (requeuedIds.current.has(current.id)) return;
    requeuedIds.current.add(current.id);
    setSession((prev) => {
      requeuedSlots.current.add(prev.positions.length);
      return { ...prev, positions: [...prev.positions, current] };
    });
  };

  const revealIdea = () => {
    const now = latest.current;
    const current = now.drill;
    if (!current) return;
    const result = dispatch({
      type: 'reveal',
      sudden: now.sudden,
      move: solutionMove(current),
    });
    if (!result.accepted) return;
    started.current = true;
    if (now.reviewing) requeueIfNeeded(current);
    if (!requeuedSlots.current.has(now.index)) {
      applyRoundEffects(result.effects, current, now.reviewing && !now.practicingAhead);
    }
  };

  const stepHint = () => {
    if (sudden || round !== 'playing') return;
    if (hintStep >= 2) {
      revealIdea();
      return;
    }
    setHintStep((step) => step + 1);
  };

  const onMove = useCallback(
    (event: BoardMoveEvent) => {
      const now = latest.current;
      const current = now.drill;
      if (!current) return false;
      const ok = isCorrectDrillMove(current, event.from, event.to, event.promotion);
      const result = dispatch({
        type: 'answer',
        correct: ok,
        afterFen: event.afterFen,
        move: { from: event.from, to: event.to },
        san: event.san,
        line: ok ? [] : punishmentLine(current, event.from, event.to, event.promotion),
        sudden: now.sudden,
        missText: ok ? '' : missFeedback(current, event.from, event.to),
      });
      if (!result.accepted) return false;
      started.current = true;
      const isRepeat = requeuedSlots.current.has(now.index);
      const scheduledReview = now.reviewing && !now.practicingAhead && !isRepeat;
      if (scheduledReview && ok) {
        const entry = useProgressStore.getState().review.find((item) => item.id === current.id);
        const days = nextReviewGapDays(entry);
        setNextGapLabel(`Next review in ${formatReviewGap(days)}.`);
        setNextGapShort(`Next: ${formatReviewGap(days)}`);
      } else {
        setNextGapLabel(null);
        setNextGapShort(null);
      }
      if (now.reviewing && !ok) {
        requeueIfNeeded(current);
      }
      if (!isRepeat) {
        applyRoundEffects(result.effects, current, scheduledReview);
      }
      return ok;
    },
    [dispatch],
  );

  const replayActive = runSummary == null && (round === 'retry' || round === 'streakEnd');
  const playback = usePunishmentPlayback(replayActive, state.replayLine);
  const board = trainerBoard(playback, state, drill?.fen ?? '', replayActive);
  const trigger = useTriggerAnimation(
    `${puzzleId ?? ''}-${index}`,
    board.fen,
    drill?.source?.setupFen,
    drill?.source?.lastMove,
    round === 'playing',
  );

  const showRunSummary = () => {
    const current = drill;
    if (!current) return;
    const stillOnMiss = round === 'streakEnd';
    const played =
      state.missedPlay?.san ??
      (state.lastMove ? playedSan(current.fen, state.lastMove.from, state.lastMove.to) : null);
    setRunSummary({
      saved: state.score.correct,
      best: shownBest(state.score.correct, bestPuzzleStreak),
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
  const baseSpeech = drill ? roundSpeech(round, drill, state.shownIdea ? null : state.lastMove) : '';
  const clubRadar = useMemo(() => {
    if (!unprompted || round !== 'correct' || !drill || !state.lastMove || state.shownIdea) return null;
    if (/Watch /i.test(baseSpeech)) return null;
    return clubTacticalWarning(drill.fen, state.lastMove.from, state.lastMove.to, drill.sideToMove);
  }, [baseSpeech, drill, round, state.lastMove, state.shownIdea, unprompted]);
  const gameMoveNote =
    round !== 'playing' && drill?.source?.move && !baseSpeech.includes(drill.source.move)
      ? `In your game you played ${drill.source.move}.`
      : null;
  const parts = [baseSpeech, clubRadar, gameMoveNote, round === 'correct' ? nextGapLabel : null].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );
  const roundCopy = parts.join(' ');
  const compactNote =
    round === 'correct' && nextGapShort
      ? nextGapShort
      : drill?.source?.move && round !== 'playing'
        ? `Played ${drill.source.move}`
        : undefined;

  const hintArrow = useMemo(
    () => (round === 'playing' && !sudden && hintStep >= 2 && drill ? threatAttackerArrow(drill) : null),
    [drill, hintStep, round, sudden],
  );
  const threatFrom = !state.shownIdea ? playback.arrow?.from : undefined;
  const threatTo = !state.shownIdea ? playback.arrow?.to : undefined;
  const threatArrow = useMemo<BoardArrow[]>(() => {
    if (threatFrom && threatTo) {
      return [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }];
    }
    if (hintArrow) {
      return [{ from: hintArrow.from, to: hintArrow.to, color: markColor('warning', scheme, colors) }];
    }
    return [];
  }, [colors, hintArrow, scheme, threatFrom, threatTo]);
  const showAttention = (guided || (!sudden && hintStep >= 1)) && round === 'playing' && !trigger.animating;
  const attentionSquares = useMemo(
    () => (showAttention && drill ? [drill.atRiskSquare] : []),
    [showAttention, drill],
  );
  const promptVisible = guided || (!sudden && hintStep >= 2);

  return {
    guided,
    promptVisible,
    unprompted,
    setUnprompted: setUnpromptedOverride,
    blitzTimer,
    setBlitzTimer,
    secondsLeft,
    hintStep,
    stepHint,
    difficulty,
    streak: sudden,
    source,
    reviewing,
    practicingAhead,
    upcomingCount,
    reviewSaves: reviewEntry?.saves ?? 0,
    sourceLabel,
    sourceUrl,
    hydrated,
    runSummary,
    done,
    drill,
    session,
    index,
    round,
    score: state.score,
    orientation,
    boardFen: round === 'playing' ? trigger.fen : board.fen,
    boardLastMove: round === 'playing' ? trigger.lastMove : board.lastMove,
    progress,
    marks,
    roundCopy,
    compactNote,
    threatArrow,
    attentionSquares,
    watchingReply: board.watchingReply,
    replyReady: board.replyReady,
    shownIdea: state.shownIdea,
    runOver: state.runOver,
    bestPuzzleStreak,
    hasReplay: state.replayLine.length > 0,
    replayReply: playback.replay,
    skipReply: playback.skip,
    onMove,
    revealIdea,
    tryAgain,
    next,
    restart,
    practiceAhead,
    showRunSummary,
    begin,
    theme,
    mode,
  };
}
