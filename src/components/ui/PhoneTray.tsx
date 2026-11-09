import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PHONE_BANNER } from '@/src/components/ui/phoneSlots';
import { play } from '@/src/components/ui/playStyles';
import { useLayout } from '@/src/components/ui/useLayout';
import { spacing } from '@/src/theme';

/**
 * The phone result sits in one fixed-height slot under the board.
 * Swapping coach copy for a save or a blunder does not change that height.
 */
export function PhoneTray({ banner, children }: { banner: ReactNode; children?: ReactNode }) {
  const { phone } = useLayout();
  if (!phone) {
    return (
      <View style={play.stack}>
        {banner}
        {children}
      </View>
    );
  }
  return (
    <View style={styles.tray}>
      <View style={styles.banner}>{banner}</View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    width: '100%',
    minWidth: 0,
    gap: spacing.sm,
  },
  banner: {
    height: PHONE_BANNER,
    width: '100%',
    overflow: 'hidden',
  },
});
