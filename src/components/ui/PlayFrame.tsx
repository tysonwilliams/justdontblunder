import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BoardStage } from '@/src/components/ui/BoardStage';
import { Screen } from '@/src/components/ui/Screen';
import { useLayout } from '@/src/components/ui/useLayout';
import { spacing } from '@/src/theme';

type PlayProps = {
  intro?: ReactNode;
  board: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  asideFirst?: boolean;
};

export function PlayFrame(props: PlayProps) {
  return (
    <Screen variant="board">
      <BoardStage {...props} />
    </Screen>
  );
}

type ScoreProps = {
  toolbar?: ReactNode;
  board?: ReactNode;
  children: ReactNode;
};

/** Completion and streak-over moments: a board with the score beside it, or a focused card. */
export function ScoreFrame({ toolbar, board, children }: ScoreProps) {
  const { split, boardWidth, asideWidth, gap } = useLayout();
  const paired = Boolean(board) && split;

  return (
    <Screen variant={paired ? 'board' : 'page'}>
      <View style={styles.score}>
        {toolbar}
        {paired ? (
          <View style={[styles.pair, { gap }]}>
            <View style={{ width: Math.min(boardWidth, 640), maxWidth: '100%' }}>{board}</View>
            <View style={[styles.scoreSide, { width: Math.min(asideWidth, 420) }]}>{children}</View>
          </View>
        ) : (
          <View style={styles.solo}>
            {board ? <View style={styles.soloBoard}>{board}</View> : null}
            <View style={styles.soloCard}>{children}</View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  score: {
    width: '100%',
    gap: spacing.lg,
  },
  pair: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  scoreSide: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  solo: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.lg,
  },
  soloBoard: {
    width: '100%',
    maxWidth: 520,
  },
  soloCard: {
    width: '100%',
    maxWidth: 460,
  },
});
