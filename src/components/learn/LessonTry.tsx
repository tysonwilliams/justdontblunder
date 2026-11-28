import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { lessonProgress, roundKind, type LessonPhase } from '@/src/components/learn/lessonPhase';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { Button } from '@/src/components/ui/Button';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import { threatAttackerArrow } from '@/src/logic/difficulty';
import { isCorrectDrillMove } from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import type { Lesson } from '@/src/logic/lessons';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { roundSpeech } from '@/src/logic/saveFeedback';
import { markColor, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

type TryRound = 'playing' | 'correct' | 'retry' | 'revealed';

const LESSON_PUNISHMENT_MS = 950;

export function LessonTry({
  lesson,
  index,
  maxSlot,
  onSelectPhase,
  onOutcome,
  onPrev,
  onBack,
  onNext,
}: {
  lesson: Lesson;
  index: number;
  maxSlot?: number;
  onSelectPhase?: (target: LessonPhase) => void;
  onOutcome?: (firstTrySaved: boolean) => void;
  onPrev?: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const task = lesson.tries[index];
  const drill = task?.drill;
  const [round, setRound] = useState<TryRound>('playing');
  const [hintStep, setHintStep] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(drill?.fen ?? null);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine, LESSON_PUNISHMENT_MS);
  const replyReady = !replayActive || playback.done;
  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );
  const { colors, scheme } = useTheme();
  const { phone } = useLayout();
  const recordedOutcome = useRef(false);
  const latest = useRef({ drill, round, onOutcome });
  latest.current = { drill, round, onOutcome };

  const hintArrow = useMemo(() => (drill ? threatAttackerArrow(drill) : null), [drill]);
  const hintOriginSquare = useMemo(() => {
    const uci = drill?.solution[0];
    return uci && uci.length >= 2 ? (uci.slice(0, 2) as Square) : null;
  }, [drill]);

  const onMove = useCallback((event: BoardMoveEvent) => {
    const current = latest.current.drill;
    if (!current || latest.current.round !== 'playing') return false;
    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    const ok = isCorrectDrillMove(current, event.from, event.to, event.promotion);
    if (!recordedOutcome.current) {
      recordedOutcome.current = true;
      latest.current.onOutcome?.(ok);
    }
    if (ok) {
      setReplayLine([]);
      setRound('correct');
      return true;
    }
    setReplayLine(punishmentLine(current, event.from, event.to, event.promotion));
    setRound('retry');
    return false;
  }, []);

  const tryAgain = useCallback(() => {
    const current = latest.current.drill;
    if (!current) return;
    setReplayLine([]);
    setDisplayFen(current.fen);
    setLastMove(null);
    setRound('playing');
  }, []);

  const reveal = useCallback(() => {
    const current = latest.current.drill;
    if (!current) return;
    const uci = current.solution[0];
    if (!uci || uci.length < 4) return;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promo = uci.length >= 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
    const game = createGame(current.fen);
    const moved = tryMove(game, from, to, promo);
    if (!moved) return;
    if (!recordedOutcome.current) {
      recordedOutcome.current = true;
      latest.current.onOutcome?.(false);
    }
    setDisplayFen(game.fen());
    setLastMove({ from: moved.from, to: moved.to });
    setReplayLine([]);
    setRound('revealed');
  }, []);

  const stepHint = useCallback(() => {
    if (latest.current.round !== 'playing') return;
    if (hintStep === 0) {
      setHintStep(1);
      return;
    }
    reveal();
  }, [hintStep, reveal]);

  useKeyboardShortcuts(
    {
      ArrowLeft: round === 'playing' && onPrev ? onPrev : undefined,
      Enter: () => {
        if (round === 'correct' || round === 'revealed') {
          onNext();
          return true;
        }
        if (round === 'retry' && replyReady) {
          tryAgain();
          return true;
        }
        return false;
      },
      ' ': () => {
        if (round === 'correct' || round === 'revealed') {
          onNext();
          return true;
        }
        if (round === 'retry' && replyReady) {
          tryAgain();
          return true;
        }
        return false;
      },
      h: () => {
        if (round !== 'playing') return false;
        stepHint();
        return true;
      },
      r: () => {
        if (round === 'revealed') {
          tryAgain();
          return true;
        }
        if (round !== 'retry' || !replyReady) return false;
        tryAgain();
        return true;
      },
      p: () => {
        if (round !== 'retry' || !replyReady || replayLine.length === 0) return false;
        playback.replay();
        return true;
      },
    },
    Boolean(task && drill),
  );

  if (!task || !drill) return null;

  const boardFen = playback.fen ?? displayFen ?? drill.fen;
  const boardLastMove = playback.move ?? lastMove;
  const marks = highlightsForRound(roundKind(round), lastMove, drill.atRiskSquare);
  const threatFrom = playback.arrow?.from;
  const threatTo = playback.arrow?.to;
  const boardArrows: BoardArrow[] =
    threatFrom && threatTo
      ? [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }]
      : round === 'playing' && hintStep >= 1 && hintArrow
        ? [{ from: hintArrow.from, to: hintArrow.to, color: markColor('warning', scheme, colors) }]
        : [];

  const attentionSquares: Square[] =
    round !== 'playing'
      ? []
      : hintStep >= 1 && !hintArrow && hintOriginSquare && hintOriginSquare !== drill.atRiskSquare
        ? [drill.atRiskSquare, hintOriginSquare]
        : [drill.atRiskSquare];

  const copy = roundSpeech(roundKind(round), drill, lastMove);
  const phase: LessonPhase = { kind: 'try', index };
  const progress = lessonProgress(lesson, phase, round === 'correct' || round === 'revealed' ? 1 : 0.35);
  const coachLine =
    hintStep >= 1
      ? hintArrow
        ? `Watch the amber arrow from ${hintArrow.from} to ${hintArrow.to} — stop that threat.`
        : 'Look closely at the highlighted piece — it has a safe answer.'
      : task.coach;

  return (
    <PlayFrame
      intro={
        <LessonLead
          lesson={lesson}
          kicker={`Try ${index + 1}/${lesson.tries.length}`}
          detail={drill.prompt}
          progress={progress}
          phase={phase}
          maxSlot={maxSlot}
          onSelectPhase={onSelectPhase}
          onBack={onBack}
        />
      }
      board={
        <ChessBoard
          fen={boardFen}
          orientation={orientation}
          flipCue={!phone && orientation === 'black'}
          interactive={round === 'playing'}
          hideTurn
          lastMove={boardLastMove}
          arrows={boardArrows}
          attentionSquares={attentionSquares}
          highlightSquares={marks.squares}
          highlightTone={marks.tone}
          onMove={onMove}
        />
      }
      aside={
        <PhoneTray
          banner={
            round === 'playing' ? (
              <View style={[play.guide, phone && play.phoneCard, phone && styles.phoneCoach]}>
                <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : 4}>
                  {coachLine}
                </Text>
                {phone ? null : (
                  <Text style={text.muted}>
                    {hintStep >= 1 ? 'Still stuck? Show the idea to see one safe move.' : 'The amber square is the piece to watch.'}
                  </Text>
                )}
                <View style={styles.coachActions}>
                  {onPrev && !phone ? (
                    <Button
                      variant="ghost"
                      label={index === 0 ? 'Examples' : 'Back'}
                      fullWidth={false}
                      testID="lesson-try-back"
                      onPress={onPrev}
                    />
                  ) : null}
                  <Button
                    compact={phone}
                    label={hintStep === 0 ? 'Hint' : 'Show the idea'}
                    variant="secondary"
                    testID={hintStep === 0 ? 'lesson-hint' : 'lesson-idea'}
                    onPress={stepHint}
                    style={styles.grow}
                  />
                </View>
              </View>
            ) : (
              <TryResult
                round={round}
                message={copy}
                ready={replyReady}
                hasReplay={replayLine.length > 0}
                onAgain={tryAgain}
                onReplay={playback.replay}
                onSkipReply={playback.skip}
                onNext={onNext}
              />
            )
          }
        />
      }
    />
  );
}

function TryResult({
  round,
  message,
  ready,
  hasReplay,
  onAgain,
  onReplay,
  onSkipReply,
  onNext,
}: {
  round: Exclude<TryRound, 'playing'>;
  message: string;
  ready: boolean;
  hasReplay: boolean;
  onAgain: () => void;
  onReplay: () => void;
  onSkipReply: () => void;
  onNext: () => void;
}) {
  switch (round) {
    case 'correct':
      return (
        <BlunderOverlay
          visible
          tone="success"
          title="Nice save"
          message={message}
          actionLabel="Next"
          onDismiss={onNext}
          actionTestID="lesson-next"
        />
      );
    case 'revealed':
      return (
        <BlunderOverlay
          visible
          tone="warn"
          title="Here's the idea"
          message={message}
          actionLabel="Next"
          onDismiss={onNext}
          actionTestID="lesson-next"
          secondaryLabel="Try it"
          onSecondary={onAgain}
          secondaryTestID="lesson-try-again"
        />
      );
    case 'retry':
      return (
        <BlunderOverlay
          visible
          tone="danger"
          title="Blunder"
          message={message}
          waiting={ready ? undefined : 'Showing reply…'}
          onWaitingPress={ready ? undefined : onSkipReply}
          actionLabel={ready ? 'Try again' : undefined}
          onDismiss={ready ? onAgain : undefined}
          actionTestID="try-again"
          secondaryLabel={ready && hasReplay ? 'Replay' : undefined}
          onSecondary={ready && hasReplay ? onReplay : undefined}
          secondaryTestID="replay-reply"
        />
      );
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

const styles = themedStyleSheet(() => ({
  phoneCoach: {
    paddingVertical: spacing[4],
    gap: spacing[4],
    justifyContent: 'center',
  },
  coachActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  grow: {
    flex: 1,
    flexBasis: 0,
  },
}));
