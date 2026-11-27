import { useCallback, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { useTrainerRound } from '@/src/components/trainer/useTrainerRound';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { usePuzzleGrowth } from '@/src/components/usePuzzleGrowth';
import {
  createHomeSession,
  homePlayPrompt,
  isCorrectDrillMove,
  personalSourceLabel,
  themeHeadline,
  type DrillPosition,
} from '@/src/logic/drills';
import { leadWithPersonal } from '@/src/logic/earlyPlay';
import { createGame, tryMove } from '@/src/logic/game';
import { buildPuzzlePool } from '@/src/logic/puzzlePool';
import { punishmentLine } from '@/src/logic/punishment';
import { learnCard } from '@/src/logic/lessons';
import { dueTodayCount } from '@/src/logic/reviewSchedule';
import { roundSpeech } from '@/src/logic/saveFeedback';
import { roundProgress, trainerBoard, type TrainerPhase } from '@/src/logic/trainerRound';
import { applyRoundEffects } from '@/src/store/trainerResult';
import { activeDailyStreak } from '@/src/store/slices/training';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

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

export function homeResultCard(round: TrainerPhase): { title: string; tone: 'success' | 'danger' | 'warn' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Nice save', tone: 'success' };
    case 'retry':
    case 'streakEnd':
      return { title: 'Blunder', tone: 'danger' };
    case 'revealed':
      return { title: "Here's the idea", tone: 'warn' };
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
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

function buildHomeSession(seedOffset = 0) {
  const own = useProgressStore.getState().ownDrills;
  const date = seedOffset === 0 ? new Date() : new Date(Date.now() + seedOffset * 86_400_000);
  const session = createHomeSession(date, useProgressStore.getState().themeStats, buildPuzzlePool(own));
  if (own.length === 0 || own.length >= session.positions.length) return session;
  return { ...session, positions: leadWithPersonal(session.positions, own, session.positions.length) };
}

export function useHomeTrainer() {
  const { colors, scheme } = useTheme();
  const { state, dispatch } = useTrainerRound();
  const [packSeed, setPackSeed] = useState(0);
  const [session, setSession] = useState(() => buildHomeSession(0));
  const hydrated = useHydrated(useProgressStore.persist);
  const started = useRef(false);
  const positionsRef = useRef(session.positions);
  positionsRef.current = session.positions;

  const dailyStreak = useProgressStore((s) => s.dailyStreak);
  const lastDrillDate = useProgressStore((s) => s.lastDrillDate);
  const review = useProgressStore((s) => s.review);
  const gameProfile = useProgressStore((s) => s.gameProfile);
  const experience = useProgressStore((s) => s.experience);
  const streak = activeDailyStreak(dailyStreak, lastDrillDate);
  const dueCount = hydrated ? dueTodayCount(review) : 0;
  const unprompted = experience === 'intermediate';
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const learn = hydrated
    ? learnCard(completedLessons)
    : { href: '/learn', title: 'Learn', body: 'Six short lessons on blunders.' };

  const index = state.index;
  const round = state.phase;
  const total = session.positions.length;
  const done = total > 0 && index >= total;
  const drill: DrillPosition | undefined = session.positions[index];
  const latest = useRef({ drill, round, index });
  latest.current = { drill, round, index };

  usePuzzleGrowth(
    !done,
    hydrated,
    latest,
    positionsRef,
    started,
    () => {
      const own = useProgressStore.getState().ownDrills;
      return { personal: own, rebuilt: buildHomeSession(packSeed).positions };
    },
    (positions) => {
      setSession((prev) => ({ ...prev, positions }));
    },
  );

  const next = () => {
    if (total === 0) return;
    started.current = true;
    dispatch({ type: 'advance', length: total, wrap: false });
  };

  const tryAgain = () => {
    dispatch({ type: 'tryAgain', fen: null });
  };

  const revealIdea = () => {
    const current = latest.current.drill;
    if (!current || latest.current.round !== 'playing') return;
    const result = dispatch({
      type: 'reveal',
      sudden: false,
      move: solutionMove(current),
    });
    if (!result.accepted) return;
    started.current = true;
    applyRoundEffects(result.effects, current, false);
  };

  const restart = () => {
    const nextSeed = packSeed + 1;
    setPackSeed(nextSeed);
    started.current = true;
    setSession(buildHomeSession(nextSeed));
    dispatch({ type: 'begin' });
  };

  const onMove = useCallback(
    (event: BoardMoveEvent) => {
      const current = latest.current.drill;
      if (!current || latest.current.round !== 'playing') return false;
      const ok = isCorrectDrillMove(current, event.from, event.to, event.promotion);
      const result = dispatch({
        type: 'answer',
        correct: ok,
        afterFen: event.afterFen,
        move: { from: event.from, to: event.to },
        san: event.san,
        line: ok ? [] : punishmentLine(current, event.from, event.to),
        sudden: false,
        missText: '',
      });
      if (!result.accepted) return false;
      started.current = true;
      applyRoundEffects(result.effects, current, false);
      return ok;
    },
    [dispatch],
  );

  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, state.replayLine);
  const board = trainerBoard(playback, state, drill?.fen ?? '', replayActive);
  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );
  const progress = drill ? roundProgress(index, round, total) : 1;
  const marks = useMemo(
    () =>
      drill
        ? highlightsForRound(round, state.lastMove, drill.atRiskSquare)
        : { squares: [] as Square[], tone: 'danger' as const },
    [drill, round, state.lastMove],
  );
  const card = homeResultCard(round);
  const baseSpeech = drill ? roundSpeech(round, drill, state.shownIdea ? null : state.lastMove) : '';
  const gameMoveNote =
    round !== 'playing' && drill?.source?.move && !baseSpeech.includes(drill.source.move)
      ? `In your game you played ${drill.source.move}.`
      : null;
  const roundCopy = [baseSpeech, gameMoveNote].filter(Boolean).join(' ');
  const threatFrom = !state.shownIdea ? playback.arrow?.from : undefined;
  const threatTo = !state.shownIdea ? playback.arrow?.to : undefined;
  const threatArrow = useMemo<BoardArrow[]>(() => {
    if (!threatFrom || !threatTo) return [];
    return [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }];
  }, [colors, scheme, threatFrom, threatTo]);
  const attentionSquares = useMemo(
    () => (!unprompted && round === 'playing' && drill ? [drill.atRiskSquare] : []),
    [unprompted, round, drill],
  );
  const headline = drill ? themeHeadline(drill.theme) : 'Stop hanging pieces.';
  const prompt = drill ? (unprompted ? `${drill.sideToMove === 'w' ? 'White' : 'Black'} to move. Find a safe move.` : homePlayPrompt(drill)) : '';
  const sourceLabel = useMemo(() => (drill ? personalSourceLabel(drill) : null), [drill]);

  return {
    drill,
    done,
    score: state.score,
    dueCount,
    hasProfile: gameProfile != null,
    total,
    index,
    round,
    hydrated,
    streak,
    learn,
    unprompted,
    headline,
    sourceLabel,
    orientation,
    boardFen: board.fen,
    boardLastMove: board.lastMove,
    progress,
    marks,
    card,
    roundCopy,
    threatArrow,
    attentionSquares,
    prompt,
    replyReady: board.replyReady,
    watchingReply: board.watchingReply,
    hasReplay: state.replayLine.length > 0,
    replayReply: playback.replay,
    onMove,
    revealIdea,
    next,
    tryAgain,
    restart,
  };
}
