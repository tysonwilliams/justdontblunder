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
  type DrillSourceFilter,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { dueTodayCount } from '@/src/logic/reviewSchedule';
import { useProgressStore } from '@/src/store/progress';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export type DrillToolbarProps = {
  mode: DrillMode;
  theme: ThemeFilter;
  /** Sudden-death rules. Only shown while Play is selected. */
  streak?: boolean;
  /** Filter strictly to imported personal blunders when `'own'`. */
  source?: DrillSourceFilter;
  /** Hide theme spoiler and pre-highlighted amber danger square until Hint is tapped. */
  unprompted?: boolean;
  /** Optional 15-second Blitz Check countdown per puzzle. */
  blitzTimer?: boolean;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  onStreak?: (streak: boolean) => void;
  onSource?: (source: DrillSourceFilter) => void;
  onUnprompted?: (unprompted: boolean) => void;
  onBlitzTimer?: (blitzTimer: boolean) => void;
};

const MODE_LABEL: Record<DrillMode, string> = {
  play: 'Play',
  pick: 'Pick',
  review: 'Review',
};

const MODE_DETAIL: Record<DrillMode, string> = {
  play: 'Make any safe move on the board.',
  pick: 'Compare two arrows and choose the safe move.',
  review: 'Replay positions due for spaced review.',
};

export function DrillToolbar({
  mode,
  theme,
  streak = false,
  source = 'all',
  unprompted = false,
  blitzTimer = false,
  onMode,
  onTheme,
  onStreak,
  onSource,
  onUnprompted,
  onBlitzTimer,
}: DrillToolbarProps) {
  const { colors } = useTheme();
  const { phone, topNav } = useLayout();
  const [open, setOpen] = useState(false);
  const review = useProgressStore((state) => state.review);
  const ownCount = useProgressStore((state) => state.ownDrills.length);
  const due = dueTodayCount(review);
  const showOwnFilter = mode !== 'review' && ownCount > 0 && Boolean(onSource);

  const filtered = mode !== 'play' || theme !== 'all' || (showOwnFilter && source === 'own');
  const summaryParts = [MODE_LABEL[mode]];
  if (showOwnFilter && source === 'own') summaryParts.push('My games');
  if (theme !== 'all') summaryParts.push(themeFilterLabel(theme));
  const summary = summaryParts.join(' · ');

  const modeOptions = DRILL_MODES.map((item) => ({
    id: item.id,
    label: item.id === 'review' && due > 0 ? `${MODE_LABEL[item.id]} (${due})` : MODE_LABEL[item.id],
    spoken: item.id === 'review' && due > 0 ? `${item.label}, ${due} due` : item.label,
    testID: `drill-mode-${item.id}`,
  }));

  const sourceOptions: { id: DrillSourceFilter; label: string; testID: string }[] = [
    { id: 'all', label: 'All puzzles', testID: 'drill-source-all' },
    { id: 'own', label: `My games (${ownCount})`, testID: 'drill-source-own' },
  ];

  if (!phone) {
    return (
      <View style={styles.deskWrap}>
        <View style={styles.deskTopRow}>
          <View style={styles.deskModeWrap}>
            <SegmentedControl height={36} value={mode} onChange={onMode} options={modeOptions} />
          </View>
          <View style={styles.right}>
            <ColorLegend compact={false} />
            {!topNav ? <MenuButton /> : null}
          </View>
        </View>
        <View style={styles.deskThemeRow}>
          {showOwnFilter && onSource ? (
            <Pressable
              {...controlA11y('button', `My games only (${ownCount})`, source === 'own')}
              testID="drill-source-own"
              onPress={() => onSource(source === 'own' ? 'all' : 'own')}
              style={(state) => {
                const hovered = 'hovered' in state && Boolean(state.hovered);
                return [
                  styles.deskThemePill,
                  source === 'own' && styles.deskThemePillOn,
                  (hovered || state.pressed) && source !== 'own' && styles.deskThemePillHover,
                ];
              }}>
              <Text
                style={[styles.deskThemeLabel, source === 'own' && styles.deskThemeLabelOn]}
                numberOfLines={1}>
                My games ({ownCount})
              </Text>
            </Pressable>
          ) : null}
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
                    styles.deskThemePill,
                    selected && styles.deskThemePillOn,
                    (hovered || state.pressed) && !selected && styles.deskThemePillHover,
                  ];
                }}>
                <Text
                  style={[styles.deskThemeLabel, selected && styles.deskThemeLabelOn]}
                  numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {mode !== 'pick' && (onStreak || onUnprompted || onBlitzTimer) ? (
          <View style={styles.deskStreakRow}>
            {mode === 'play' && onStreak ? (
              <SettingSwitch compact label="Streak" value={streak} onChange={onStreak} testID="streak-toggle" />
            ) : null}
            {!streak && onUnprompted ? (
              <SettingSwitch
                compact
                label="No hints"
                value={unprompted}
                onChange={onUnprompted}
                testID="unprompted-toggle"
              />
            ) : null}
            {onBlitzTimer ? (
              <SettingSwitch
                compact
                label="15s"
                value={blitzTimer}
                onChange={onBlitzTimer}
                testID="blitz-timer-toggle"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <View style={[styles.bar, styles.barPhone]}>
        <Pressable
          {...controlA11y('button', `Drill options: ${summary}`, open)}
          testID="drill-options-trigger"
          onPress={() => setOpen(true)}
          style={(state) => {
            const hovered = 'hovered' in state && Boolean(state.hovered);
            return [
              styles.trigger,
              styles.triggerPhone,
              filtered && styles.triggerActive,
              (hovered || state.pressed) && !filtered && styles.triggerHover,
              state.pressed && styles.pressed,
            ];
          }}>
          <IconSliders color={filtered ? colors.accent : colors.textMuted} size={14} />
          <Text
            style={[styles.triggerText, styles.triggerTextPhone, filtered && styles.triggerTextActive]}
            numberOfLines={1}>
            {summary}
          </Text>
          <IconChevronDown color={filtered ? colors.accent : colors.textDim} size={14} />
        </Pressable>

        <View style={styles.right}>
          {mode === 'play' && onStreak ? (
            <SettingSwitch compact label="Streak" value={streak} onChange={onStreak} testID="streak-toggle" />
          ) : null}
          <ColorLegend compact />
          {!topNav ? <MenuButton compact /> : null}
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
          <SegmentedControl height={38} value={mode} onChange={onMode} options={modeOptions} />
        </View>

        {showOwnFilter && onSource ? (
          <View style={styles.section}>
            <Text style={text.section}>Source</Text>
            <SegmentedControl height={38} value={source} onChange={onSource} options={sourceOptions} />
          </View>
        ) : null}

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

        {mode !== 'pick' && (onUnprompted || onBlitzTimer) ? (
          <View style={styles.section}>
            <View style={styles.divider} />
            {!streak && onUnprompted ? (
              <>
                <SettingSwitch
                  plain
                  label="Unprompted scanning"
                  value={unprompted}
                  onChange={onUnprompted}
                  testID="unprompted-toggle"
                />
                <Text style={styles.helper}>Hide the amber highlight and theme spoiler until you ask for a hint.</Text>
              </>
            ) : null}
            {onBlitzTimer ? (
              <>
                <SettingSwitch
                  plain
                  label="Blitz check (15s)"
                  value={blitzTimer}
                  onChange={onBlitzTimer}
                  testID="blitz-timer-toggle"
                />
                <Text style={styles.helper}>Practice spotting threats under a 15-second clock.</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Button label="Done" onPress={() => setOpen(false)} testID="drill-options-done" />
      </Sheet>
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  deskWrap: {
    width: '100%',
    gap: spacing[8],
  },
  deskTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  deskModeWrap: {
    flex: 1,
    maxWidth: 320,
  },
  deskThemeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[6],
  },
  deskThemePill: {
    minHeight: 30,
    paddingHorizontal: spacing[10],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deskThemePillOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  deskThemePillHover: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  deskThemeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  deskThemeLabelOn: {
    color: colors.accent,
  },
  deskStreakRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[8],
  },
  deskStreakNote: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
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
