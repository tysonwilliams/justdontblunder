import { Pressable, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { FilterChips } from '@/src/components/ui/Chip';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  DRILL_MODES,
  THEME_FILTERS,
  type DrillMode,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

type Props = {
  mode: DrillMode;
  theme: ThemeFilter;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
};

const PHONE_MODE_LABEL: Record<DrillMode, string> = {
  streak: 'Streak',
  pick: 'Pick',
  play: 'Play',
  review: 'Review',
};

export function DrillToolbar({ mode, theme, onMode, onTheme }: Props) {
  useTheme();
  const { phone } = useLayout();
  if (phone) {
    return (
      <View style={styles.toolbar}>
        <View style={styles.segments}>
          {DRILL_MODES.map((item) => {
            const selected = item.id === mode;
            return (
              <Pressable
                key={item.id}
                {...controlA11y('button', item.label, selected)}
                testID={`drill-mode-${item.id}`}
                onPress={() => onMode(item.id)}
                style={[styles.segment, selected && styles.segmentOn]}>
                <Text style={[styles.segmentText, selected && styles.segmentTextOn]} numberOfLines={1}>
                  {PHONE_MODE_LABEL[item.id]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.themes}>
          {THEME_FILTERS.map((item) => {
            const selected = item.id === theme;
            return (
              <Pressable
                key={item.id}
                {...controlA11y('button', item.label, selected)}
                testID={`drill-theme-${item.id}`}
                onPress={() => onTheme(item.id)}
                style={[styles.theme, selected && styles.themeOn]}>
                <Text style={[styles.themeText, selected && styles.themeTextOn]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.toolbar}>
      <FilterChips
        options={DRILL_MODES.map((item) => ({ ...item, testID: `drill-mode-${item.id}` }))}
        value={mode}
        onChange={onMode}
      />
      <FilterChips
        options={THEME_FILTERS.map((item) => ({ ...item, testID: `drill-theme-${item.id}` }))}
        value={theme}
        onChange={onTheme}
      />
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  toolbar: {
    gap: spacing[6],
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  segmentOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
  },
  segmentTextOn: {
    color: colors.accentText,
  },
  themes: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  theme: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 28,
    paddingHorizontal: spacing[6],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  themeOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  themeText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
  },
  themeTextOn: {
    color: colors.accentText,
  },
}));
