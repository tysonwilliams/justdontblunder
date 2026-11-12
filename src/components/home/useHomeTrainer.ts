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
  type DrillPosition,
} from '@/src/logic/drills';
import { leadWithPersonal } from '@/src/logic/earlyPlay';
import { buildPuzzlePool } from '@/src/logic/puzzlePool';
import { punishmentLine } from '@/src/logic/punishment';
import { learnCard } from '@/src/logic/lessons';
import { coachForRound } from '@/src/logic/coach';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { roundProgress, trainerBoard, type TrainerPhase } from '@/src/logic/trainerRound';
import { applyRoundEffects } from '@/src/store/trainerResult';
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

export function homeResultCard(round: TrainerPhase): { title: string; tone: 'success' | 'danger' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Nice save', tone: 'success' };
    case 'retry':
    case 'streakEnd':
      return { title: 'Blunder', tone: 'danger' };
    case 'revealed':
      return null;
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

function buildHomeSession() {
  const own = useProgressStore.getState().ownDrills;
  const session = createHomeSession(new Date(), useProgressStore.getState().themeStats, buildPuzzlePool(own));
  if (own.length === 0 || own.length >= session.positions.length) return session;
  return { ...session, positions: leadWithPersonal(session.positions, own, session.positions.length) };
}

export function useHomeTrainer() {
  const { colors, scheme } = useTheme();
  const { state, dispatch } = useTrainerRound();
  const [session, setSession] = useState(buildHomeSession);
  const hydrated = useHydrated(useProgressStore.persist);
  const started = useRef(false);
  const positionsRef = useRef(session.positions);
  positionsRef.current = session.positions;

  const streak = useProgressStore((s) => s.dailyStreak);
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const learn = hydrated
    ? learnCard(completedLessons)
    : { href: '/learn', title: 'Learn', body: 'Six short lessons on blunders.' };

  const index = state.index;
  const round = state.phase;
  const drill: DrillPosition | undefined = session.positions[index];
  const total = session.positions.length;
  const latest = useRef({ drill, round, index });
  latest.current = { drill, round, index };

  usePuzzleGrowth(
    true,
    hydrated,
    latest,
    positionsRef,
    started,
    () => {
      const own = useProgressStore.getState().ownDrills;
      return { personal: own, rebuilt: buildHomeSession().positions };
    },
    (positions) => {
      setSession((prev) => ({ ...prev, positions }));
    },
  );

  const next = () => {
    if (total === 0) return;
    started.current = true;
    dispatch({ type: 'advance', length: total, wrap: true });
  };

  const tryAgain = () => {
    dispatch({ type: 'tryAgain', fen: null });
  };

  const onMove = useCallback(
    (event: BoardMoveEvent) => {
      const current = latest.current.drill;
      if (!current || latest.current.round !== 'playing') return false;
      const ok = isCorrectDrillMove(current, event.from, event.to);
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
  const progress = drill ? roundProgress(index, round, total) : 0;
  const marks = useMemo(
    () =>
      drill
        ? highlightsForRound(round, state.lastMove, drill.atRiskSquare)
        : { squares: [] as Square[], tone: 'danger' as const },
    [drill, round, state.lastMove],
  );
  const card = homeResultCard(round);
  const taught = drill ? (feedbackForRound(round, drill, state.lastMove) ?? '') : '';
  const coachKind = round === 'correct' ? 'save' : round === 'retry' || round === 'streakEnd' ? 'blunder' : 'idea';
  const roundCopy = drill ? coachForRound(coachKind, drill.fen, state.lastMove, taught) : '';
  const threatFrom = playback.arrow?.from;
  const threatTo = playback.arrow?.to;
  const threatArrow = useMemo<BoardArrow[]>(() => {
    if (!threatFrom || !threatTo) return [];
    return [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }];
  }, [colors, scheme, threatFrom, threatTo]);
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
    onMove,
    next,
    tryAgain,
  };
}
