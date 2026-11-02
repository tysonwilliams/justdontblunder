import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { spacing } from '@/src/theme';

/** Tight stack for the title block above a board, or at the top of the side panel. */
export function BoardLead({ children }: { children: ReactNode }) {
  const { phone } = useLayout();
  return <View style={[styles.lead, phone && styles.leadPhone]}>{children}</View>;
}

const styles = StyleSheet.create({
  lead: {
    width: '100%',
    gap: spacing.sm,
  },
  leadPhone: {
    gap: 3,
  },
});
