import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Chip, FilterChips, SegmentedControl } from '@/src/components/ui/Chip';
import { PHONE_TOOLBAR_HEIGHT } from '@/src/components/ui/phoneSlots';
import { SettingSwitch } from '@/src/components/ui/SettingSwitch';
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

export type DrillToolbarProps = {
  mode: DrillMode;
  theme: ThemeFilter;
  /** Sudden-death rules. Only shown while Play is selected. */
  streak?: boolean;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  onStreak?: (streak: boolean) => void;
};

const PHONE_MODE_LABEL: Record<DrillMode, string> = {
  play: 'Play',
  pick: 'Pick',
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

export function DrillToolbar({ mode, theme, streak = false, onMode, onTheme, onStreak }: DrillToolbarProps) {
  useTheme();
  const { phone } = useLayout();
  const streakToggle =
    mode === 'play' && onStreak ? (
      <SettingSwitch compact label="Streak" value={streak} onChange={onStreak} testID="streak-toggle" />
    ) : null;

  if (phone) {
    return (
      <View style={styles.phone}>
        <ModeRow mode={mode} onMode={onMode} phone streakToggle={streakToggle} />
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
      <ModeRow mode={mode} onMode={onMode} phone={false} streakToggle={streakToggle} />
      <FilterChips
        options={THEME_FILTERS.map((item) => ({ ...item, testID: `drill-theme-${item.id}` }))}
        value={theme}
        onChange={onTheme}
      />
    </View>
  );
}

function ModeRow({
  mode,
  onMode,
  phone,
  streakToggle,
}: {
  mode: DrillMode;
  onMode: (mode: DrillMode) => void;
  phone: boolean;
  streakToggle: ReactNode;
}) {
  if (phone) {
    return (
      <View style={styles.phoneModes}>
        <View style={styles.phoneModesGrow}>
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
        </View>
        {streakToggle}
      </View>
    );
  }

  return (
    <View style={styles.deskModes}>
      {DRILL_MODES.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          size="sm"
          selected={item.id === mode}
          testID={`drill-mode-${item.id}`}
          onPress={() => onMode(item.id)}
        />
      ))}
      {streakToggle}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  toolbar: {
    gap: spacing[6],
  },
  deskModes: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phone: {
    height: PHONE_TOOLBAR_HEIGHT,
    gap: spacing[2],
    justifyContent: 'center',
    overflow: 'hidden',
  },
  phoneModes: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  phoneModesGrow: {
    flex: 1,
    minWidth: 0,
    height: 32,
  },
}));
