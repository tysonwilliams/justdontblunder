import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BoardStage } from '@/src/components/ui/BoardStage';
import { Screen } from '@/src/components/ui/Screen';
import { spacing } from '@/src/theme';

type PlayProps = {
  intro?: ReactNode;
  board: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
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
  if (board) {
    return <PlayFrame intro={toolbar} board={board} aside={children} />;
  }

  return (
    <Screen variant="page">
      <View style={styles.score}>
        {toolbar}
        <View style={styles.soloCard}>{children}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  score: {
    width: '100%',
    gap: spacing.lg,
  },
  soloCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
});
