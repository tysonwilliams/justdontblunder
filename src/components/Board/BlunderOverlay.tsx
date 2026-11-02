import { StyleSheet, Text, View } from 'react-native';

import { liveA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { IconCheck, IconInfo, IconX } from '@/src/components/ui/icons';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { colors, fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

type Tone = 'danger' | 'success' | 'warn';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  tone?: Tone;
  hint?: string;
  actionLabel?: string;
  onDismiss?: () => void;
  actionTestID?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Shown in place of the buttons while a punishment line is still playing. */
  waiting?: string;
};

export function BlunderOverlay({
  visible,
  title,
  message,
  tone = 'danger',
  hint,
  actionLabel = 'Got it',
  onDismiss,
  actionTestID,
  secondaryLabel,
  onSecondary,
  waiting,
}: Props) {
  const { phone, tight, contentHeight } = useLayout();
  if (!visible) return null;
  const toneColor = toneColors(tone);
  const iconSize = phone ? 16 : 22;
  const rowActions = phone || contentHeight < 800;

  return (
    <View {...liveA11y()} style={[styles.card, phone && styles.cardPhone, { borderColor: toneColor.accent }]}>
      <View style={styles.head}>
        <View style={[styles.badge, phone && styles.badgePhone, { backgroundColor: toneColor.soft }]}>
          <ToneIcon tone={tone} color={toneColor.accent} size={iconSize} />
        </View>
        <Text style={[styles.title, phone && styles.titlePhone]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text style={[text.body, phone && styles.messagePhone]} numberOfLines={tight ? 3 : phone ? 4 : undefined}>
        {message}
      </Text>
      {hint ? (
        <View style={[styles.hintBox, phone && styles.hintBoxPhone]}>
          <Text style={styles.hintLabel}>Try</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}
      {waiting && !onDismiss ? <Text style={[styles.waiting, phone && styles.waitingPhone]}>{waiting}</Text> : null}
      {rowActions && (onDismiss || (onSecondary && secondaryLabel)) ? (
        <View style={styles.actions}>
          {onDismiss ? (
            <Button
              label={actionLabel}
              onPress={onDismiss}
              testID={actionTestID}
              style={styles.action}
            />
          ) : null}
          {onSecondary && secondaryLabel ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" style={styles.action} />
          ) : null}
        </View>
      ) : (
        <>
          {onDismiss ? <Button label={actionLabel} onPress={onDismiss} testID={actionTestID} /> : null}
          {onSecondary && secondaryLabel ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
          ) : null}
        </>
      )}
    </View>
  );
}

function ToneIcon({ tone, color, size }: { tone: Tone; color: string; size: number }) {
  switch (tone) {
    case 'success':
      return <IconCheck color={color} size={size} />;
    case 'warn':
      return <IconInfo color={color} size={size} />;
    case 'danger':
      return <IconX color={color} size={size} />;
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function toneColors(tone: Tone): { accent: string; soft: string } {
  switch (tone) {
    case 'success':
      return { accent: colors.success, soft: colors.successSoft };
    case 'warn':
      return { accent: colors.warning, soft: colors.warningSoft };
    case 'danger':
      return { accent: colors.danger, soft: colors.dangerSoft };
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPhone: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderRadius: radii.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.circleLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePhone: {
    width: 26,
    height: 26,
    borderRadius: radii.circleSm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSizes[22],
    lineHeight: lineHeights[28],
    color: colors.text,
    letterSpacing: letterSpacing.tight,
  },
  titlePhone: {
    fontSize: fontSizes[16],
    lineHeight: lineHeights[20],
  },
  messagePhone: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[17],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  action: {
    flex: 1,
    flexBasis: 0,
  },
  hintBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    gap: spacing.xxs,
  },
  hintBoxPhone: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing[6],
  },
  hintLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    letterSpacing: letterSpacing.pill,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  hint: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    color: colors.text,
  },
  waiting: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    color: colors.textMuted,
  },
  waitingPhone: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[17],
  },
});
