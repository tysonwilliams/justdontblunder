import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { IconCheck, IconInfo, IconX } from '@/src/components/ui/icons';
import { colors, fonts, radii } from '@/src/theme';

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
  if (!visible) return null;
  const toneColor = toneColors(tone);

  return (
    <View style={[styles.card, { borderColor: toneColor.accent }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: toneColor.soft }]}>
          <ToneIcon tone={tone} color={toneColor.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      {hint ? (
        <View style={styles.hintBox}>
          <Text style={styles.hintLabel}>Try</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}
      {waiting && !onDismiss ? <Text style={styles.waiting}>{waiting}</Text> : null}
      {onDismiss ? (
        <Button label={actionLabel} onPress={onDismiss} testID={actionTestID} />
      ) : null}
      {onSecondary && secondaryLabel ? (
        <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
      ) : null}
    </View>
  );
}

function ToneIcon({ tone, color }: { tone: Tone; color: string }) {
  switch (tone) {
    case 'success':
      return <IconCheck color={color} size={22} />;
    case 'warn':
      return <IconInfo color={color} size={22} />;
    case 'danger':
      return <IconX color={color} size={22} />;
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
      return { accent: colors.warn, soft: colors.warnSoft };
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
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  hintBox: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  hintLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  hint: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  waiting: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.textMuted,
  },
});
