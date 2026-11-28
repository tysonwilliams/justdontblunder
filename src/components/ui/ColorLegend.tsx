import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { IconHelp } from '@/src/components/ui/icons';
import { Sheet } from '@/src/components/ui/Sheet';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import { PRE_MOVE_STEPS, TIME_TROUBLE_CHECK } from '@/src/logic/antiBlunderGuide';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

const SHORTCUTS: readonly { key: string; action: string }[] = [
  { key: 'Enter / Space', action: 'Next drill or try again' },
  { key: 'H', action: 'Next hint or show the idea' },
  { key: 'R', action: 'Try again after a blunder' },
  { key: 'P', action: 'Replay the opponent’s capture' },
  { key: '1 / 2 or A / B', action: 'Choose a move in Pick mode' },
  { key: 'U / F', action: 'Undo move or flip board in Practice' },
  { key: 'Right-click drag', action: 'Draw arrows or highlight squares' },
  { key: '?', action: 'Toggle this guide' },
];

/**
 * Quiet "?" trigger that opens the board color guide, 4-step pre-move check,
 * and desktop shortcuts in a clean sheet, keeping board screens uncluttered.
 */
export function ColorLegend({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const { phone } = useLayout();
  const [open, setOpen] = useState(false);

  useKeyboardShortcuts(
    {
      '?': () => {
        setOpen((current) => !current);
        return true;
      },
    },
    !phone,
  );

  const items = [
    { label: 'Good save', detail: 'A safe move that avoids losing material or getting mated.', color: colors.success },
    { label: 'Blunder', detail: 'Hangs material or allows mate in one.', color: colors.danger },
    { label: 'In danger', detail: 'The piece or square currently under threat.', color: colors.warning },
  ];

  return (
    <>
      <Pressable
        {...controlA11y('button', 'Board color guide and pre-move checklist', open)}
        testID="color-legend-trigger"
        hitSlop={spacing.xs}
        onPress={() => setOpen(true)}
        style={(state) => {
          const hovered = 'hovered' in state && Boolean(state.hovered);
          return [
            styles.trigger,
            compact && styles.triggerCompact,
            (hovered || state.pressed) && styles.triggerHover,
            state.pressed && styles.pressed,
          ];
        }}>
        <IconHelp color={colors.textDim} size={compact ? 16 : 18} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Board guide" testID="color-legend-sheet">
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.label} style={styles.item}>
              <View style={[styles.swatch, { backgroundColor: item.color }]} />
              <View style={styles.copy}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.detail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.section} testID="board-guide-checklist">
          <Text style={text.section}>Before every move</Text>
          <View style={styles.checkList}>
            {PRE_MOVE_STEPS.map((step) => (
              <View key={step.number} style={styles.checkRow}>
                <View style={styles.checkBadge}>
                  <Text style={styles.checkBadgeText}>{step.number}</Text>
                </View>
                <Text style={styles.checkText}>
                  <Text style={styles.checkTitle}>{step.title}: </Text>
                  {step.detail}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.blitzNote}>
            <Text style={styles.checkTitle}>{TIME_TROUBLE_CHECK.title}: </Text>
            {TIME_TROUBLE_CHECK.summary}
          </Text>
        </View>
        {!phone ? (
          <View style={styles.shortcuts} testID="keyboard-shortcuts-guide">
            <Text style={text.section}>Keyboard shortcuts</Text>
            <View style={styles.shortcutList}>
              {SHORTCUTS.map((row) => (
                <View key={row.key} style={styles.shortcutRow}>
                  <View style={styles.keyCap}>
                    <Text style={styles.keyText}>{row.key}</Text>
                  </View>
                  <Text style={styles.shortcutAction}>{row.action}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  trigger: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  triggerCompact: {
    width: 26,
    height: 26,
  },
  triggerHover: {
    backgroundColor: colors.hover,
  },
  pressed: {
    opacity: 0.78,
  },
  list: {
    gap: spacing[10],
    paddingBottom: spacing[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[12],
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: radii.dot,
    marginTop: spacing[4],
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    gap: spacing[2],
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
  },
  detail: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
    gap: spacing[8],
  },
  checkList: {
    gap: spacing[6],
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: radii.badge,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[1],
    flexShrink: 0,
  },
  checkBadgeText: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accent,
  },
  checkText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  checkTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  blitzNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
  },
  shortcuts: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
    gap: spacing[8],
  },
  shortcutList: {
    gap: spacing[6],
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[10],
  },
  keyCap: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  keyText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.text,
  },
  shortcutAction: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
}));
