import { View } from 'react-native';

import { FilterChips, SegmentedControl } from '@/src/components/ui/Chip';
import { PHONE_TOOLBAR_HEIGHT } from '@/src/components/ui/phoneSlots';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  DRILL_MODES,
  THEME_FILTERS,
  type DrillMode,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { spacing } from '@/src/theme';

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

const PHONE_THEME_LABEL: Record<ThemeFilter, string> = {
  all: 'All',
  hanging: 'Hang',
  fork: 'Fork',
  pin: 'Pin',
  back_rank: 'Rank',
  missed_mate: 'Mate',
};

export function DrillToolbar({ mode, theme, onMode, onTheme }: Props) {
  useTheme();
  const { phone } = useLayout();
  if (phone) {
    return (
      <View style={styles.phone}>
        <SegmentedControl
          height={32}
          value={mode}
          onChange={onMode}
          options={DRILL_MODES.map((item) => ({
            id: item.id,
            label: PHONE_MODE_LABEL[item.id],
            spoken: item.label,
            testID: `drill-mode-${item.id}`,
          }))}
        />
        <SegmentedControl
          height={26}
          value={theme}
          onChange={onTheme}
          options={THEME_FILTERS.map((item) => ({
            id: item.id,
            label: PHONE_THEME_LABEL[item.id],
            spoken: item.label,
            testID: `drill-theme-${item.id}`,
          }))}
        />
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

const styles = themedStyleSheet(() => ({
  toolbar: {
    gap: spacing[6],
  },
  phone: {
    height: PHONE_TOOLBAR_HEIGHT,
    gap: spacing[2],
    justifyContent: 'center',
  },
}));
