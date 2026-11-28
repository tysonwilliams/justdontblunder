import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/src/components/SettingsMenu';
import {
  LESSON_INDEX,
  lessonSteps,
  lessonTrack,
  phaseSlotIndex,
  type LessonPhase,
} from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { LineBox } from '@/src/components/ui/LineBox';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import type { Lesson } from '@/src/logic/lessons';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

export function LessonLead({
  lesson,
  kicker,
  detail,
  progress,
  phase,
  maxSlot,
  onSelectPhase,
  onBack,
}: {
  lesson: Lesson;
  kicker: string;
  detail: string;
  progress: number;
  phase?: LessonPhase;
  maxSlot?: number;
  onSelectPhase?: (target: LessonPhase) => void;
  onBack: () => void;
}) {
  useTheme();
  const { phone, topNav } = useLayout();
  const place = LESSON_INDEX[lesson.id];
  const track = lessonTrack(lesson.id);
  const steps = !phone && phase && onSelectPhase ? lessonSteps(lesson) : [];
  const activeSlot = phase ? phaseSlotIndex(lesson, phase) : -1;
  const highestSlot = Math.max(activeSlot, maxSlot ?? activeSlot);

  return (
    <BoardLead gap={phone ? spacing[6] : spacing[10]}>
      <View style={[play.metaRow, phone && lessonStyles.metaPhone]}>
        <Text style={[text.eyebrow, phone && lessonStyles.eyebrowPhone, lessonStyles.kicker]} numberOfLines={1}>
          {track.label} {place}/{track.total} · {kicker}
        </Text>
        <View style={lessonStyles.metaActions}>
          <Pressable
            {...controlA11y('button', 'All lessons')}
            testID="lesson-all"
            onPress={onBack}
            hitSlop={spacing.sm}
            style={(state) => [lessonStyles.back, state.pressed && lessonStyles.backPressed]}>
            <Text style={[text.meta, phone && text.metaPhone]} numberOfLines={1}>
              All lessons
            </Text>
          </Pressable>
          {!topNav ? <MenuButton compact={phone} /> : null}
        </View>
      </View>
      <LineBox height={phone ? 22 : 32}>
        <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
          {lesson.title}
        </Text>
      </LineBox>
      <LineBox height={phone ? 16 : 22}>
        <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
          {detail}
        </Text>
      </LineBox>
      <LineBox height={phone ? 6 : 8}>
        <ProgressTrack progress={progress} />
      </LineBox>
      {steps.length > 0 && onSelectPhase ? (
        <View style={styles.stepStrip} testID="lesson-step-strip">
          {steps.map((slot, slotIdx) => {
            const active = slotIdx === activeSlot;
            const visited = slotIdx < activeSlot || slotIdx <= highestSlot;
            const canJump = slot.kind === 'card' || visited;
            return (
              <Pressable
                key={`${slot.kind}-${slot.index}`}
                {...controlA11y('button', slot.label, active)}
                disabled={!canJump}
                testID={`lesson-jump-${slot.kind}-${slot.index}`}
                onPress={() => onSelectPhase({ kind: slot.kind, index: slot.index })}
                style={(state) => {
                  const hovered = 'hovered' in state && Boolean(state.hovered);
                  return [
                    styles.pill,
                    active && styles.pillActive,
                    !active && visited && styles.pillDone,
                    !canJump && styles.pillLocked,
                    canJump && !active && (hovered || state.pressed) && styles.pillHover,
                  ];
                }}>
                <Text
                  style={[
                    styles.pillText,
                    active && styles.pillTextActive,
                    !active && visited && styles.pillTextDone,
                  ]}
                  numberOfLines={1}>
                  {slot.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </BoardLead>
  );
}

const styles = themedStyleSheet((colors) => ({
  stepStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[4],
  },
  pill: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    cursor: 'pointer',
  },
  pillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pillDone: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  pillHover: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  pillLocked: {
    opacity: 0.45,
    cursor: 'auto',
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.textDim,
  },
  pillTextActive: {
    color: colors.accent,
  },
  pillTextDone: {
    color: colors.textMuted,
  },
}));
