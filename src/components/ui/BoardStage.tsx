import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { spacing } from '@/src/theme';

type Props = {
  board: ReactNode;
  aside: ReactNode;
};

const WIDE = 900;

export function BoardStage({ board, aside }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  return (
    <View style={[styles.stage, wide && styles.stageWide]}>
      <View style={styles.board}>{board}</View>
      <View style={[styles.aside, wide && styles.asideWide]}>{aside}</View>
    </View>
  );
}

export function boardStageIsWide(width: number): boolean {
  return width >= WIDE;
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    gap: spacing.md,
  },
  stageWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  board: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  aside: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  asideWide: {
    flex: 1,
    maxWidth: 360,
    alignSelf: 'stretch',
    paddingTop: 28,
  },
});
