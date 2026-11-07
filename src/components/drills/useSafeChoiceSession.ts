import { useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import type { BoardArrow } from '@/src/components/Board/boardTypes';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { sessionForTheme, type ThemeFilter } from '@/src/logic/drillLink';
import { isCorrectDrillMove, type DrillPosition, type DrillSession as DrillSessionData } from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { presentSafeChoice, safeChoiceFor, type PresentedSafeChoice } from '@/src/logic/safeChoice';
import { feedbackForRound, type DrillRound } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';
import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';

export type SafeRound = 'playing' | 'correct' | 'retry';

export function safeResultCard(round: SafeRound): { title: string; tone: 'success' | 'danger' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Safe move', tone: 'success' };
    case 'retry':
      return { title: 'Blunder', tone: 'danger' };
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

function roundKind(round: SafeRound): DrillRound {
  switch (round) {
    case 'playing':
      return 'playing';
    case 'correct':
      return 'correct';
    case 'retry':
      return 'retry';
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

export function useSafeChoiceSession(theme: ThemeFilter) {
  const { colors, scheme } = useTheme();
  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);
  const [session, setSession] = useState<DrillSessionData>(() => sessionForTheme(theme));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<SafeRound>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const resultCounted = useRef(false);
  const lock = useRef(false);

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;
  const choice = useMemo(() => (drill ? safeChoiceFor(drill) : null), [drill]);
  const presented = useMemo(() => (choice ? presentSafeChoice(choice) : null), [choice]);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;
  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const resetBoard = () => {
    lock.current = false;
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setReplayLine([]);
  };

  const begin = (nextSession: DrillSessionData) => {
    resultCounted.current = false;
    setSession(nextSession);
    setIndex(0);
    setScore({ correct: 0, total: 0 });
    resetBoard();
  };

  useEffect(() => {
    if (!drill || presented) return;
    setIndex((i) => i + 1);
  }, [drill, presented]);

  useEffect(() => {
    if (!drill) return;
    resultCounted.current = false;
    lock.current = false;
    setDisplayFen(drill.fen);
    setRound('playing');
    setLastMove(null);
    setReplayLine([]);
  }, [drill?.id, drill?.fen]);

  const next = () => {
    resultCounted.current = false;
    lock.current = false;
    setIndex((i) => i + 1);
    resetBoard();
  };

  const tryAgain = () => {
    if (!drill) return;
    lock.current = false;
    setReplayLine([]);
    setDisplayFen(drill.fen);
    setLastMove(null);
    setRound('playing');
  };

  const recordFirst = (correct: boolean) => {
    if (!drill) return;
    const claim = claimDrillResult(resultCounted.current);
    resultCounted.current = claim.claimed;
    if (!claim.recorded) return;
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    markDrillResult(correct, drill.theme);
    if (!correct) recordMiss(drill.id);
  };

  const choose = (key: 'A' | 'B') => {
    if (!drill || !presented || round !== 'playing' || lock.current) return;
    const option = presented.options.find((item) => item.key === key);
    if (!option) return;
    const passed = isCorrectDrillMove(drill, option.from, option.to);
    if (passed !== (key === presented.safeKey)) return;
    const game = createGame(drill.fen);
    const played = tryMove(game, option.from, option.to);
    if (!played) return;
    lock.current = true;
    setDisplayFen(game.fen());
    setLastMove({ from: played.from, to: played.to });
    if (passed) {
      recordFirst(true);
      setReplayLine([]);
      setRound('correct');
      playMoveSound(soundForSan(played.san));
      return;
    }
    recordFirst(false);
    setReplayLine(punishmentLine(drill, option.from, option.to));
    setRound('retry');
    playMoveSound('fail');
  };

  const boardFen = playback.fen ?? displayFen ?? drill?.fen ?? '';
  const boardLastMove = playback.move ?? lastMove;
  const progress = drill ? (index + (round === 'playing' ? 0 : 1)) / session.positions.length : 0;
  const marks = useMemo(
    () =>
      drill
        ? highlightsForRound(roundKind(round), lastMove, drill.atRiskSquare)
        : { squares: [] as Square[], tone: 'danger' as const },
    [drill, round, lastMove],
  );
  const card = safeResultCard(round);
  const roundCopy = drill ? (feedbackForRound(roundKind(round), drill, lastMove) ?? '') : '';
  const arrows = useMemo<BoardArrow[]>(() => {
    if (round === 'playing' && presented) {
      return presented.options.map((option) => ({
        from: option.from,
        to: option.to,
        color: markColor('info', scheme, colors),
        label: option.key,
      }));
    }
    if (playback.arrow) return [{ from: playback.arrow.from, to: playback.arrow.to, color: markColor('danger', scheme, colors) }];
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
    score,
    orientation,
    boardFen,
    boardLastMove,
    progress,
    marks,
    card,
    roundCopy,
    arrows,
    attentionSquares,
    replyReady,
    watchingReply: replayActive && !playback.done,
    choose,
    next,
    tryAgain,
    begin,
  };
}

export type { PresentedSafeChoice };
