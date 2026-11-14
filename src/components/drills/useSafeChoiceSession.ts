import { useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { useTrainerRound } from '@/src/components/trainer/useTrainerRound';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { usePuzzleGrowth } from '@/src/components/usePuzzleGrowth';
import { playFeedback } from '@/src/feedback/playFeedback';
import { sessionForTheme, type ThemeFilter } from '@/src/logic/drillLink';
import { isCorrectDrillMove, type DrillPosition, type DrillSession as DrillSessionData } from '@/src/logic/drills';
import { buildPuzzlePool } from '@/src/logic/puzzlePool';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine } from '@/src/logic/punishment';
import { presentSafeChoice, safeChoiceFor, type PresentedSafeChoice } from '@/src/logic/safeChoice';
import { coachForRound } from '@/src/logic/coach';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { roundProgress, trainerBoard, type TrainerPhase } from '@/src/logic/trainerRound';
import { applyRoundEffects } from '@/src/store/trainerResult';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

export type SafeRound = 'playing' | 'correct' | 'retry';

export function safeResultCard(round: TrainerPhase): { title: string; tone: 'success' | 'danger' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Safe move', tone: 'success' };
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

export function useSafeChoiceSession(theme: ThemeFilter) {
  const { colors, scheme } = useTheme();
  const { state, dispatch } = useTrainerRound();
  const hydrated = useHydrated(useProgressStore.persist);
  const [session, setSession] = useState<DrillSessionData>(() =>
    sessionForTheme(theme, buildPuzzlePool(useProgressStore.getState().ownDrills)),
  );
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
  const choice = useMemo(() => (drill ? safeChoiceFor(drill) : null), [drill]);
  const presented = useMemo(() => (choice ? presentSafeChoice(choice) : null), [choice]);
  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const begin = (nextSession: DrillSessionData) => {
    started.current = true;
    dispatch({ type: 'begin' });
    setSession(nextSession);
  };

  usePuzzleGrowth(
    true,
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
    if (!drill || presented) return;
    dispatch({ type: 'advance', length: session.positions.length, wrap: false });
  }, [drill, presented, dispatch, session.positions.length]);

  const next = () => {
    started.current = true;
    dispatch({ type: 'advance', length: session.positions.length, wrap: false });
  };

  const tryAgain = () => {
    if (!drill) return;
    dispatch({ type: 'tryAgain', fen: drill.fen });
  };

  const choose = (key: 'A' | 'B') => {
    if (!drill || !presented || round !== 'playing') return;
    const option = presented.options.find((item) => item.key === key);
    if (!option) return;
    const passed = isCorrectDrillMove(drill, option.from, option.to);
    if (passed !== (key === presented.safeKey)) return;
    const game = createGame(drill.fen);
    const played = tryMove(game, option.from, option.to);
    if (!played) return;
    const result = dispatch({
      type: 'answer',
      correct: passed,
      afterFen: game.fen(),
      move: { from: played.from, to: played.to },
      san: played.san,
      line: passed ? [] : punishmentLine(drill, option.from, option.to),
      sudden: false,
      missText: '',
    });
    if (!result.accepted) return;
    started.current = true;
    applyRoundEffects(result.effects, drill, false);
    playFeedback(passed ? 'save' : 'blunder');
  };

  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, state.replayLine);
  const board = trainerBoard(playback, state, drill?.fen ?? '', replayActive);
  const progress = drill ? roundProgress(index, round, session.positions.length) : 0;
  const marks = useMemo(
    () =>
      drill
        ? highlightsForRound(round, state.lastMove, drill.atRiskSquare)
        : { squares: [] as Square[], tone: 'danger' as const },
    [drill, round, state.lastMove],
  );
  const card = safeResultCard(round);
  const taught = drill ? (feedbackForRound(round, drill, state.lastMove) ?? '') : '';
  const coachKind = round === 'correct' ? 'save' : round === 'retry' || round === 'streakEnd' ? 'blunder' : 'idea';
  const roundCopy = drill ? coachForRound(coachKind, drill.fen, state.lastMove, taught) : '';
  const arrows = useMemo<BoardArrow[]>(() => {
    if (round === 'playing' && presented) {
      return presented.options.map((option) => ({
        from: option.from,
        to: option.to,
        color: markColor('info', scheme, colors),
        label: option.key,
      }));
    }
    if (playback.arrow) {
      return [{ from: playback.arrow.from, to: playback.arrow.to, color: markColor('danger', scheme, colors) }];
    }
    return [];
  }, [colors, playback.arrow, presented, round, scheme]);
  const attentionSquares = useMemo(
    () => (round === 'playing' && drill ? [drill.atRiskSquare] : []),
    [drill, round],
  );

  return {
    theme,
    done,
    drill,
    presented,
    session,
    index,
    round,
    score: state.score,
    orientation,
    boardFen: board.fen,
    boardLastMove: board.lastMove,
    progress,
    marks,
    card,
    roundCopy,
    arrows,
    attentionSquares,
    replyReady: board.replyReady,
    watchingReply: board.watchingReply,
    choose,
    next,
    tryAgain,
    begin,
    restart: () => begin(sessionForTheme(theme, buildPuzzlePool(useProgressStore.getState().ownDrills))),
  };
}

export type { PresentedSafeChoice };
