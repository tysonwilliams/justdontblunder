import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { LessonLead } from '@/src/components/learn/LessonLead';
import {
  arrowsForBeat,
  beatBadge,
  lessonProgress,
  nextBeatCta,
  readingDelayMs,
  squaresForBeat,
  type LessonPhase,
} from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { cueForLessonTone } from '@/src/feedback/cues';
import { playFeedback } from '@/src/feedback/playFeedback';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import type { Lesson, ResolvedBeat } from '@/src/logic/lessons';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

function useBeatController(cardId: string, beats: readonly ResolvedBeat[], initialIndex: number, reduced: boolean) {
  const count = beats.length;
  const clampedInit = Math.max(0, Math.min(Math.max(count - 1, 0), initialIndex));
  const [state, setState] = useState({ cardId, index: clampedInit, auto: false });
  if (state.cardId !== cardId) {
    setState({ cardId, index: clampedInit, auto: false });
  }
  const index = state.cardId === cardId ? Math.min(state.index, Math.max(count - 1, 0)) : clampedInit;
  const auto = state.cardId === cardId ? state.auto : false;
  const currentText = beats[index]?.text ?? '';

  useEffect(() => {
    if (!auto || reduced || count <= 1 || index >= count - 1) return;
    const delay = readingDelayMs(currentText);
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.cardId !== cardId || !prev.auto) return prev;
        const next = Math.min(prev.index + 1, count - 1);
        return { cardId, index: next, auto: next < count - 1 };
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [auto, cardId, count, currentText, index, reduced]);

  const stepPrev = () => {
    setState({ cardId, index: Math.max(0, index - 1), auto: false });
  };
  const stepNext = () => {
    setState({ cardId, index: Math.min(count - 1, index + 1), auto: false });
  };
  const jumpTo = (target: number) => {
    setState({ cardId, index: Math.max(0, Math.min(count - 1, target)), auto: false });
  };
  const toggleAuto = () => {
    if (count <= 1) return;
    if (auto) {
      setState({ cardId, index, auto: false });
      return;
    }
    const startAt = index >= count - 1 ? 0 : index;
    setState({ cardId, index: startAt, auto: !reduced });
  };
  const replay = () => {
    if (count <= 1) return;
    setState({ cardId, index: 0, auto: !reduced });
  };

  return {
    index,
    auto: auto && !reduced && index < count - 1,
    stepPrev,
    stepNext,
    jumpTo,
    toggleAuto,
    replay,
  };
}

function lessonCopyLines(foot: number): number {
  if (foot >= 210) return 4;
  return 3;
}

export function LessonCardView({
  lesson,
  cardIndex,
  beats,
  initialBeat = 0,
  maxSlot,
  onSelectPhase,
  onPrevCard,
  onBack,
  onNext,
}: {
  lesson: Lesson;
  cardIndex: number;
  beats: ResolvedBeat[];
  initialBeat?: number;
  maxSlot?: number;
  onSelectPhase?: (target: LessonPhase) => void;
  onPrevCard?: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const card = lesson.cards[cardIndex];
  const reduced = useReducedMotion();
  const controller = useBeatController(card?.id ?? 'card', beats, initialBeat, reduced);
  const index = controller.index;
  const beat = beats[index] ?? beats[0];
  const onLastBeat = index >= beats.length - 1;

  useEffect(() => {
    if (!beat?.san) return;
    playFeedback(cueForLessonTone(beat.tone, beat.san));
  }, [beat?.san, beat?.tone, card?.id, index]);

  const primaryAction = onLastBeat ? onNext : controller.stepNext;
  const backAction = index > 0 ? controller.stepPrev : onPrevCard;

  useKeyboardShortcuts({
    ArrowLeft: backAction,
    ArrowRight: primaryAction,
    Enter: primaryAction,
    ' ': primaryAction,
    r: beats.length > 1 ? controller.replay : undefined,
    p: beats.length > 1 && !reduced ? controller.toggleAuto : undefined,
  });

  const { colors, scheme } = useTheme();
  const { phone, slots } = useLayout();
  if (!card || !beat) return null;
  const orientation = card.sideToMove === 'b' ? 'black' : 'white';
  const marks = squaresForBeat(beat);
  const arrows = arrowsForBeat(card, beats, index, scheme, colors);
  const badge = beatBadge(beat);
  const lastCard = cardIndex + 1 >= lesson.cards.length;
  const primaryLabel = nextBeatCta(beats, index, lastCard, phone);
  const phase: LessonPhase = { kind: 'card', index: cardIndex };
  const progress = lessonProgress(lesson, phase, (index + 0.5) / Math.max(beats.length, 1));
  const boardStatus = onLastBeat
    ? 'Example complete · Click board or Next'
    : 'Example · Click board or Next to step';
  const copyLines = phone ? lessonCopyLines(slots?.foot ?? 0) : 6;

  return (
    <PlayFrame
      intro={
        <LessonLead
          lesson={lesson}
          kicker={`Example ${cardIndex + 1}/${lesson.cards.length}`}
          detail={card.title}
          progress={progress}
          phase={phase}
          maxSlot={maxSlot}
          onSelectPhase={onSelectPhase}
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
          statusText={boardStatus}
          onBoardPress={primaryAction}
          lastMove={beat.lastMove}
          arrows={arrows}
          highlightSquares={marks.squares}
          highlightTone={marks.tone}
        />
      }
      aside={
        <View
          style={[
            play.guide,
            phone && lessonStyles.cardAside,
            badge.tone === 'danger' && styles.cardDanger,
            badge.tone === 'success' && styles.cardSuccess,
          ]}
          testID="lesson-card-guide">
          <View style={styles.beatRow}>
            <View
              style={[
                styles.badge,
                badge.tone === 'danger' && styles.badgeDanger,
                badge.tone === 'success' && styles.badgeSuccess,
              ]}
              testID="lesson-beat-badge">
              <Text
                style={[
                  styles.badgeText,
                  badge.tone === 'danger' && styles.badgeTextDanger,
                  badge.tone === 'success' && styles.badgeTextSuccess,
                ]}
                numberOfLines={1}>
                {badge.label}
              </Text>
            </View>
            {beats.length > 1 ? (
              <View style={styles.beatRight}>
                <View style={styles.dots}>
                  {beats.map((_, dotIndex) => (
                    <Pressable
                      key={dotIndex}
                      {...controlA11y('button', `Step ${dotIndex + 1} of ${beats.length}`, dotIndex === index)}
                      hitSlop={spacing[6]}
                      onPress={() => controller.jumpTo(dotIndex)}
                      style={[
                        styles.dot,
                        dotIndex < index && styles.dotDone,
                        dotIndex === index && styles.dotOn,
                      ]}
                    />
                  ))}
                </View>
                <Text style={[text.meta, phone && text.metaPhone]}>
                  {index + 1}/{beats.length}
                </Text>
                {onLastBeat ? (
                  <Pressable
                    {...controlA11y('button', 'Replay example from step 1')}
                    testID="lesson-replay"
                    hitSlop={spacing[4]}
                    onPress={controller.replay}
                    style={(state) => {
                      const hovered = 'hovered' in state && Boolean(state.hovered);
                      return [styles.autoChip, (hovered || state.pressed) && styles.autoChipHover];
                    }}>
                    <Text style={styles.autoText}>Replay</Text>
                  </Pressable>
                ) : !reduced ? (
                  <Pressable
                    {...controlA11y('button', controller.auto ? 'Pause auto-play' : 'Auto-play steps', controller.auto)}
                    testID="lesson-auto-toggle"
                    hitSlop={spacing[4]}
                    onPress={controller.toggleAuto}
                    style={(state) => {
                      const hovered = 'hovered' in state && Boolean(state.hovered);
                      return [
                        styles.autoChip,
                        controller.auto && styles.autoChipOn,
                        (hovered || state.pressed) && styles.autoChipHover,
                      ];
                    }}>
                    <Text style={[styles.autoText, controller.auto && styles.autoTextOn]}>
                      {controller.auto ? 'Pause' : 'Auto'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
          <Text
            style={[text.body, phone && styles.copyPhone]}
            numberOfLines={copyLines}
            testID="lesson-beat-copy">
            {beat.text}
          </Text>
          <View style={styles.actions}>
            {backAction ? (
              <Button
                compact={phone}
                variant="secondary"
                label={index > 0 ? 'Back' : 'Prev'}
                fullWidth={false}
                testID="lesson-step-back"
                onPress={backAction}
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
  cardDanger: {
    borderColor: colors.danger,
  },
  cardSuccess: {
    borderColor: colors.success,
  },
  beatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  beatRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  badgeDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  badgeTextDanger: {
    color: colors.danger,
  },
  badgeTextSuccess: {
    color: colors.success,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    cursor: 'pointer',
  },
  dotDone: {
    backgroundColor: colors.textDim,
  },
  dotOn: {
    width: 18,
    backgroundColor: colors.accent,
  },
  autoChip: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    cursor: 'pointer',
  },
  autoChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  autoChipHover: {
    backgroundColor: colors.surfaceRaised,
  },
  autoText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.textMuted,
  },
  autoTextOn: {
    color: colors.accent,
  },
  copyPhone: {
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
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
