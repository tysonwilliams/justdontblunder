import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { IconHelp } from '@/src/components/ui/icons';
import { Sheet } from '@/src/components/ui/Sheet';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

/**
 * Quiet "?" trigger that opens the board color guide in a clean sheet,
 * keeping board screens uncluttered.
 */
export function ColorLegend({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const items = [
    { label: 'Good save', detail: 'A safe move that avoids losing material or getting mated.', color: colors.success },
    { label: 'Blunder', detail: 'Hangs material or allows mate in one.', color: colors.danger },
    { label: 'In danger', detail: 'The piece or square currently under threat.', color: colors.warning },
  ];

  return (
    <>
      <Pressable
        {...controlA11y('button', 'Board color guide', open)}
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

      <Sheet visible={open} onClose={() => setOpen(false)} title="Board colors" testID="color-legend-sheet">
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
    gap: spacing[14],
    paddingBottom: spacing.xs,
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
}));
