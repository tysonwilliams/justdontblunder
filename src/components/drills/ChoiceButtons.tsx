import { Pressable, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import type { PresentedSafeChoice } from '@/src/logic/safeChoice';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

export function ChoiceButtons({
  presented,
  onChoose,
  compact,
}: {
  presented: PresentedSafeChoice;
  onChoose: (key: 'A' | 'B') => void;
  compact: boolean;
}) {
  useTheme();
  return (
    <View style={styles.choices}>
      {presented.options.map((option) => (
        <Pressable
          key={option.key}
          {...controlA11y('button', `Move ${option.key}, ${option.san}`, false)}
          testID={`choice-${option.key}`}
          onPress={() => onChoose(option.key)}
          style={({ pressed }) => [
            styles.choice,
            compact && styles.choiceCompact,
            pressed && styles.choiceOn,
          ]}>
          <View style={[styles.choiceKey, compact && styles.choiceKeyCompact]}>
            <Text style={styles.choiceKeyText}>{option.key}</Text>
          </View>
          <Text style={[styles.choiceSan, compact && styles.choiceSanCompact]} numberOfLines={1}>
            {option.san}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
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
    minHeight: 56,
    paddingHorizontal: spacing[10],
    gap: spacing.sm,
  },
  choiceOn: {
    backgroundColor: colors.surfaceRaised,
    transform: [{ scale: 0.98 }],
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
  choiceKeyCompact: {
    width: 32,
    height: 32,
    borderRadius: radii.circleMd,
  },
  choiceSan: {
    flex: 1,
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[22],
    lineHeight: lineHeights[28],
    letterSpacing: letterSpacing.tight,
  },
  choiceSanCompact: {
    fontSize: fontSizes[18],
    lineHeight: lineHeights[22],
  },
}));
