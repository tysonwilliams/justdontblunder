import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/src/theme';

/**
 * One-line drills/learn header above the board: chip row, meta, track, title,
 * and the gaps between them. Practice uses the same minimum so the board
 * starts at the same height when those rows stay on one line.
 */
const CHIP_ROW = 34;
const META_ROW = 26;
const TRACK = 4;
const TITLE = 32;

export const boardLeadMinHeight =
  CHIP_ROW + spacing.md + META_ROW + spacing.md + TRACK + spacing.md + TITLE;

export function BoardLead({ children }: { children: ReactNode }) {
  return <View style={styles.lead}>{children}</View>;
}

const styles = StyleSheet.create({
  lead: {
    gap: spacing.md,
    minHeight: boardLeadMinHeight,
    justifyContent: 'flex-end',
  },
});
