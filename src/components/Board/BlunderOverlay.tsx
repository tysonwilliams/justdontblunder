import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { IconCheck, IconInfo, IconX } from '@/src/components/ui/icons';
import { colors, fonts } from '@/src/theme';

type Tone = 'danger' | 'success' | 'warn';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  tone?: Tone;
  hint?: string;
  actionLabel?: string;
  onDismiss?: () => void;
};

export function BlunderOverlay({
  visible,
  title,
  message,
  tone = 'danger',
  hint,
  actionLabel = 'Got it',
  onDismiss,
}: Props) {
  const toneColor = toneColors(tone);

  return (
    <Dialog visible={visible}>
      <View style={[styles.badge, { backgroundColor: toneColor.soft }]}>
        <ToneIcon tone={tone} color={toneColor.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {hint ? (
        <View style={styles.hintBox}>
          <Text style={styles.hintLabel}>Try</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}
      {onDismiss ? <Button label={actionLabel} onPress={onDismiss} /> : null}
    </Dialog>
  );
}

function ToneIcon({ tone, color }: { tone: Tone; color: string }) {
  switch (tone) {
    case 'success':
      return <IconCheck color={color} />;
    case 'warn':
      return <IconInfo color={color} />;
    case 'danger':
      return <IconX color={color} />;
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
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  hintBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 2,
  },
  hintLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  hint: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
});
