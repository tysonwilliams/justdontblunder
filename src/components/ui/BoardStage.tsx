import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { spacing } from '@/src/theme';

type Props = {
  board: ReactNode;
  aside: ReactNode;
  /** On a phone, show the feedback card before the board so it stays on screen. */
  asideFirst?: boolean;
};

const WIDE = 900;

export function BoardStage({ board, aside, asideFirst = false }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const boardPane = (
    <View style={[styles.board, wide && styles.boardWide]}>{board}</View>
  );
  const asidePane = <View style={[styles.aside, wide && styles.asideWide]}>{aside}</View>;

  return (
    <View style={[styles.stage, wide && styles.stageWide]}>
      {wide || !asideFirst ? boardPane : null}
      {asidePane}
      {!wide && asideFirst ? boardPane : null}
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
    alignSelf: 'flex-start',
  },
  boardWide: {
    flexGrow: 1.3,
    flexShrink: 1,
    maxWidth: 680,
    alignSelf: 'flex-start',
  },
  aside: {
    width: '100%',
    alignSelf: 'center',
  },
  asideWide: {
    flex: 0.9,
    maxWidth: 420,
    alignSelf: 'stretch',
    paddingTop: 36,
  },
});
