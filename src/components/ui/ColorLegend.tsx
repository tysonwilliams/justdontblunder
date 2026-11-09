import { Text, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export function ColorLegend() {
  const { colors } = useTheme();
  const { phone } = useLayout();
  const items = [
    { label: 'Good save', color: colors.success },
    { label: 'Blunder', color: colors.danger },
    { label: 'In danger', color: colors.warning },
  ];
  return (
    <View style={[styles.row, phone && styles.rowPhone]} accessibilityRole="text">
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, phone && styles.swatchPhone, { backgroundColor: item.color }]} />
          <Text style={[styles.label, phone && styles.labelPhone]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    rowGap: spacing[6],
  },
  rowPhone: {
    flexWrap: 'nowrap',
    gap: spacing.sm,
    height: 24,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    minHeight: 24,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: radii.swatch,
  },
  swatchPhone: {
    width: 8,
    height: 8,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.textDim,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
  },
  labelPhone: {
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
  },
}));
