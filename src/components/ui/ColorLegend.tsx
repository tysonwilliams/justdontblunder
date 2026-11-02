import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { colors, fonts } from '@/src/theme';

const ITEMS = [
  { label: 'Good save', color: colors.success },
  { label: 'Blunder', color: colors.danger },
  { label: 'In danger', color: colors.warn },
] as const;

export function ColorLegend() {
  const { phone } = useLayout();
  return (
    <View style={[styles.row, phone && styles.rowPhone]} accessibilityRole="text">
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, phone && styles.swatchPhone, { backgroundColor: item.color }]} />
          <Text style={[styles.label, phone && styles.labelPhone]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 6,
  },
  rowPhone: {
    flexWrap: 'nowrap',
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 24,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  swatchPhone: {
    width: 8,
    height: 8,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  labelPhone: {
    fontSize: 11,
    lineHeight: 14,
  },
});
