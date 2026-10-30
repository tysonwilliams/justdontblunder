import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/src/theme';

const ITEMS = [
  { label: 'Good save', color: colors.success },
  { label: 'Blunder', color: colors.danger },
  { label: 'In danger', color: colors.warn },
] as const;

export function ColorLegend() {
  return (
    <View style={styles.row} accessibilityRole="text">
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 14,
  },
});
