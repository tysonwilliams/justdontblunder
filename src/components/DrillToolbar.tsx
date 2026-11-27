import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/src/components/SettingsMenu';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { SegmentedControl } from '@/src/components/ui/Chip';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { IconChevronDown, IconSliders } from '@/src/components/ui/icons';
import { PHONE_TOOLBAR_HEIGHT } from '@/src/components/ui/phoneSlots';
import { SettingSwitch } from '@/src/components/ui/SettingSwitch';
import { Sheet } from '@/src/components/ui/Sheet';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  DRILL_MODES,
  THEME_FILTERS,
  themeFilterLabel,
  type DrillMode,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export type DrillToolbarProps = {
  mode: DrillMode;
  theme: ThemeFilter;
  /** Sudden-death rules. Only shown while Play is selected. */
  streak?: boolean;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  onStreak?: (streak: boolean) => void;
};

const MODE_LABEL: Record<DrillMode, string> = {
  play: 'Play',
  pick: 'Pick',
  review: 'Review',
};

const MODE_DETAIL: Record<DrillMode, string> = {
  play: 'Make any safe move on the board.',
  pick: 'Compare two arrows and choose the safe move.',
  review: 'Replay positions you missed earlier.',
};

export function DrillToolbar({ mode, theme, streak = false, onMode, onTheme, onStreak }: DrillToolbarProps) {
  const { colors } = useTheme();
  const { phone } = useLayout();
  const [open, setOpen] = useState(false);

  const filtered = mode !== 'play' || theme !== 'all';
  const summary = theme === 'all' ? MODE_LABEL[mode] : `${MODE_LABEL[mode]} · ${themeFilterLabel(theme)}`;

  return (
    <>
      <View style={[styles.bar, phone && styles.barPhone]}>
        <Pressable
          {...controlA11y('button', `Drill options: ${summary}`, open)}
          testID="drill-options-trigger"
          onPress={() => setOpen(true)}
          style={(state) => {
            const hovered = 'hovered' in state && Boolean(state.hovered);
            return [
              styles.trigger,
              phone && styles.triggerPhone,
              filtered && styles.triggerActive,
              (hovered || state.pressed) && !filtered && styles.triggerHover,
              state.pressed && styles.pressed,
            ];
          }}>
          <IconSliders color={filtered ? colors.accent : colors.textMuted} size={phone ? 14 : 16} />
          <Text
            style={[styles.triggerText, phone && styles.triggerTextPhone, filtered && styles.triggerTextActive]}
            numberOfLines={1}>
            {summary}
          </Text>
          <IconChevronDown color={filtered ? colors.accent : colors.textDim} size={14} />
        </Pressable>

        <View style={styles.right}>
          {mode === 'play' && onStreak ? (
            <SettingSwitch compact label="Streak" value={streak} onChange={onStreak} testID="streak-toggle" />
          ) : null}
          <ColorLegend compact={phone} />
          {phone ? <MenuButton compact /> : null}
        </View>
      </View>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Drill options"
        subtitle={MODE_DETAIL[mode]}
        testID="drill-options-sheet">
        <View style={styles.section}>
          <Text style={text.section}>Mode</Text>
          <SegmentedControl
            height={38}
            value={mode}
            onChange={onMode}
            options={DRILL_MODES.map((item) => ({
              id: item.id,
              label: MODE_LABEL[item.id],
              spoken: item.label,
              testID: `drill-mode-${item.id}`,
            }))}
          />
        </View>

        <View style={styles.section}>
          <Text style={text.section}>Theme</Text>
          <View style={styles.themeGrid}>
            {THEME_FILTERS.map((item) => {
              const selected = item.id === theme;
              return (
                <Pressable
                  key={item.id}
                  {...controlA11y('button', item.label, selected)}
                  testID={`drill-theme-${item.id}`}
                  onPress={() => onTheme(item.id)}
                  style={(state) => {
                    const hovered = 'hovered' in state && Boolean(state.hovered);
                    return [
                      styles.themeOption,
                      selected && styles.themeOptionOn,
                      (hovered || state.pressed) && !selected && styles.themeOptionHover,
                    ];
                  }}>
                  <Text
                    style={[styles.themeLabel, selected && styles.themeLabelOn]}
                    numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {mode === 'play' && onStreak ? (
          <View style={styles.section}>
            <View style={styles.divider} />
            <SettingSwitch plain label="Streak (sudden death)" value={streak} onChange={onStreak} />
            <Text style={styles.helper}>No hints. One blunder ends the run.</Text>
          </View>
        ) : null}

        <Button label="Done" onPress={() => setOpen(false)} testID="drill-options-done" />
      </Sheet>
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  bar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  barPhone: {
    height: PHONE_TOOLBAR_HEIGHT,
    overflow: 'hidden',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    minHeight: 40,
    maxWidth: '100%',
    flexShrink: 1,
    paddingHorizontal: spacing[12],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    cursor: 'pointer',
  },
  triggerPhone: {
    minHeight: 32,
    height: 32,
    paddingHorizontal: spacing[10],
    gap: spacing[5],
  },
  triggerActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  triggerHover: {
    backgroundColor: colors.surfaceRaised,
  },
  pressed: {
    opacity: 0.84,
  },
  triggerText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
    flexShrink: 1,
  },
  triggerTextPhone: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
  },
  triggerTextActive: {
    color: colors.accent,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flexShrink: 0,
  },
  section: {
    gap: spacing[10],
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeOption: {
    width: '48%',
    flexGrow: 1,
    minHeight: 42,
    paddingHorizontal: spacing[12],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  themeOptionOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  themeOptionHover: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  themeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
    color: colors.text,
  },
  themeLabelOn: {
    color: colors.accentText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
    marginTop: -spacing[6],
  },
}));
