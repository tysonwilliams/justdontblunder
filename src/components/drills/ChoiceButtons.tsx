import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import type { PresentedSafeChoice } from '@/src/logic/safeChoice';
import { colors, fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

export function ChoiceButtons({
  presented,
  onChoose,
  compact,
}: {
  presented: PresentedSafeChoice;
  onChoose: (key: 'A' | 'B') => void;
  compact: boolean;
}) {
  return (
    <View style={styles.choices}>
      {presented.options.map((option) => (
        <Pressable
          key={option.key}
          {...controlA11y('button', `Move ${option.key}, ${option.san}`, false)}
          testID={`choice-${option.key}`}
          onPress={() => onChoose(option.key)}
          style={({ pressed }) => [styles.choice, compact && styles.choiceCompact, pressed && styles.choiceOn]}>
          <View style={styles.choiceKey}>
            <Text style={styles.choiceKeyText}>{option.key}</Text>
          </View>
          <Text style={styles.choiceSan}>{option.san}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: {
    flexDirection: 'row',
    gap: spacing[10],
  },
  choice: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    paddingHorizontal: spacing[14],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    cursor: 'pointer',
  },
  choiceCompact: {
    minHeight: 48,
    paddingHorizontal: spacing[10],
    gap: spacing.sm,
  },
  choiceOn: {
    backgroundColor: colors.surfaceRaised,
  },
  choiceKey: {
    width: 36,
    height: 36,
    borderRadius: radii.circleMd,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceKeyText: {
    fontFamily: fonts.bodyExtra,
    color: colors.onInfo,
    fontSize: fontSizes[18],
  },
  choiceSan: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[22],
    lineHeight: lineHeights[28],
    letterSpacing: letterSpacing.tight,
  },
});
