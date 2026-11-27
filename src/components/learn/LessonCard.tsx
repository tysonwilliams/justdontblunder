import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChessBoard, type BoardArrow } from '@/src/components/Board/ChessBoard';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { squaresForBeat } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { cueForLessonTone } from '@/src/feedback/cues';
import { playFeedback } from '@/src/feedback/playFeedback';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { LineBox } from '@/src/components/ui/LineBox';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import type { Lesson, ResolvedBeat } from '@/src/logic/lessons';
import { markColor, radii, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

const BEAT_AUTO_MS = 1450;

function useBeatController(cardId: string, count: number) {
  const [state, setState] = useState({ cardId, index: 0, auto: true });
  if (state.cardId !== cardId) setState({ cardId, index: 0, auto: true });
  const index = state.cardId === cardId ? state.index : 0;
  const auto = state.cardId === cardId ? state.auto : true;

  useEffect(() => {
    if (!auto || count <= 1) return;
    if (index >= count - 1) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.cardId !== cardId || !prev.auto) return prev;
        const next = Math.min(prev.index + 1, count - 1);
        return { cardId, index: next, auto: next < count - 1 };
      });
    }, BEAT_AUTO_MS);
    return () => clearTimeout(timer);
  }, [auto, cardId, count, index]);

  const stepPrev = () => {
    setState({ cardId, index: Math.max(0, index - 1), auto: false });
  };
  const stepNext = () => {
    setState({ cardId, index: Math.min(count - 1, index + 1), auto: false });
  };
  const jumpTo = (target: number) => {
    setState({ cardId, index: Math.max(0, Math.min(count - 1, target)), auto: false });
  };
  const replay = () => {
    setState({ cardId, index: 0, auto: true });
  };

  return {
    index: Math.min(index, Math.max(count - 1, 0)),
    stepPrev,
    stepNext,
    jumpTo,
    replay,
  };
}

function lessonCopyLines(foot: number): number {
  const room = foot - 76;
  if (room >= 17 * 3) return 3;
  return 2;
}

function lessonCopyHeight(foot: number): number {
  return lessonCopyLines(foot) * 17;
}

export function LessonCardView({
  lesson,
  cardIndex,
  beats,
  progress,
  onBack,
  onNext,
}: {
  lesson: Lesson;
  cardIndex: number;
  beats: ResolvedBeat[];
  progress: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const card = lesson.cards[cardIndex];
  const controller = useBeatController(card?.id ?? 'card', beats.length);
  const index = controller.index;
  const beat = beats[index] ?? beats[0];
  const onLastBeat = index >= beats.length - 1;

  useEffect(() => {
    if (!beat?.san) return;
    playFeedback(cueForLessonTone(beat.tone, beat.san));
  }, [beat?.san, beat?.tone, card?.id, index]);

  useKeyboardShortcuts({
    ArrowLeft: index > 0 ? controller.stepPrev : undefined,
    ArrowRight: onLastBeat ? onNext : controller.stepNext,
    Enter: onLastBeat ? onNext : controller.stepNext,
    ' ': onLastBeat ? onNext : controller.stepNext,
    r: beats.length > 1 ? controller.replay : undefined,
  });

  const { colors, scheme } = useTheme();
  const { phone, slots } = useLayout();
  if (!card || !beat) return null;
  const orientation = card.sideToMove === 'b' ? 'black' : 'white';
  const marks = squaresForBeat(beat);
  const arrows: BoardArrow[] =
    beat.tone === 'setup'
      ? (card.arrows ?? []).map((arrow) => ({ from: arrow.from, to: arrow.to, color: markColor('warning', scheme, colors) }))
      : [];
  const lastCard = cardIndex + 1 >= lesson.cards.length;
  const primaryLabel = onLastBeat ? (lastCard ? 'Try it' : 'Next card') : 'Next step';
  const primaryAction = onLastBeat ? onNext : controller.stepNext;

  return (
    <PlayFrame
      intro={
        <LessonLead
          lesson={lesson}
          kicker={`Card ${cardIndex + 1} of ${lesson.cards.length}`}
          detail={card.title}
          progress={progress}
          onBack={onBack}
        />
      }
      board={
        <ChessBoard
          fen={beat.fen}
          orientation={orientation}
          flipCue={!phone && orientation === 'black'}
          interactive={false}
          hideTurn
          lastMove={beat.lastMove}
          arrows={arrows}
          highlightSquares={marks.squares}
          highlightTone={marks.tone}
        />
      }
      aside={
        <View style={[play.guide, phone && lessonStyles.cardAside]}>
          {beats.length > 1 ? (
            <View style={styles.beatRow}>
              <View style={styles.dots}>
                {beats.map((_, dotIndex) => (
                  <Pressable
                    key={dotIndex}
                    {...controlA11y('button', `Step ${dotIndex + 1} of ${beats.length}`, dotIndex === index)}
                    hitSlop={spacing[6]}
                    onPress={() => controller.jumpTo(dotIndex)}
                    style={[styles.dot, dotIndex === index && styles.dotOn]}
                  />
                ))}
              </View>
              <Text style={[text.meta, phone && text.metaPhone]}>
                Step {index + 1}/{beats.length}
              </Text>
            </View>
          ) : null}
          {phone ? (
            <LineBox height={lessonCopyHeight(slots?.foot ?? 0)}>
              <Text style={[text.body, text.bodyPhone]} numberOfLines={lessonCopyLines(slots?.foot ?? 0)}>
                {beat.text}
              </Text>
            </LineBox>
          ) : (
            <Text style={text.body} numberOfLines={5}>
              {beat.text}
            </Text>
          )}
          <View style={styles.actions}>
            {beats.length > 1 ? (
              <Button
                compact={phone}
                variant="secondary"
                label={index > 0 ? 'Back' : 'Replay'}
                fullWidth={false}
                testID="lesson-step-back"
                onPress={index > 0 ? controller.stepPrev : controller.replay}
              />
            ) : null}
            <Button
              compact={phone}
              label={primaryLabel}
              testID="lesson-next"
              onPress={primaryAction}
              style={styles.primaryGrow}
            />
          </View>
        </View>
      }
    />
  );
}

const styles = themedStyleSheet((colors) => ({
  beatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    cursor: 'pointer',
  },
  dotOn: {
    width: 20,
    backgroundColor: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  primaryGrow: {
    flex: 1,
    flexBasis: 0,
  },
}));
