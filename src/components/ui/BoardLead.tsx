import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/src/theme';

/** Tight stack for the title block above a board, or at the top of the side panel. */
export function BoardLead({ children }: { children: ReactNode }) {
  return <View style={styles.lead}>{children}</View>;
}

const styles = StyleSheet.create({
  lead: {
    width: '100%',
    gap: spacing.sm,
  },
});
