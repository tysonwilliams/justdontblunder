import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { withBoardSize } from '@/src/components/Board/boardGeometry';
import { useLayout } from '@/src/components/ui/useLayout';

type Props = {
  board: ReactNode;
  aside?: ReactNode;
  /** Title, filters, and progress. Beside the board when the stage is split. */
  intro?: ReactNode;
  /** Secondary links under the controls. */
  footer?: ReactNode;
  /** On a phone, show feedback before the board so it stays on screen. */
  asideFirst?: boolean;
};

export function boardStageIsWide(width: number): boolean {
  return width >= 720;
}

export function BoardStage({ board, aside, intro, footer, asideFirst = false }: Props) {
  const metrics = useLayout();
  const [box, setBox] = useState({ w: 0, h: 0 });

  const onBox = (event: LayoutChangeEvent) => {
    const next = {
      w: Math.round(event.nativeEvent.layout.width),
      h: Math.round(event.nativeEvent.layout.height),
    };
    setBox((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
  };

  const boxW = box.w || metrics.contentW;
  const boxH = box.h || metrics.contentHeight;
  const boardWidth = resolveBoardWidth(metrics.split, metrics.boardWidth, metrics.asideWidth, metrics.gap, metrics.turnRow, boxW, boxH);
  const asideWidth = metrics.split
    ? Math.min(metrics.asideWidth, Math.max(0, boxW - boardWidth - metrics.gap))
    : boxW;

  if (metrics.split) {
    const rowWidth = Math.min(boxW, boardWidth + metrics.gap + asideWidth);
    return (
      <View style={styles.fill} onLayout={onBox}>
        <View style={[styles.row, { width: rowWidth, gap: metrics.gap }]}>
          <View style={[styles.board, { width: boardWidth }]}>{withBoardSize(board, boardWidth)}</View>
          <View style={[styles.side, { width: asideWidth, gap: metrics.gap }]}>
            {intro}
            {aside}
            {footer}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.stack, { gap: metrics.gap }]} onLayout={onBox}>
      {intro ? <View style={styles.full}>{intro}</View> : null}
      {aside && asideFirst ? <View style={styles.full}>{aside}</View> : null}
      <View style={[styles.board, { width: boardWidth }]}>{withBoardSize(board, boardWidth)}</View>
      {aside && !asideFirst ? <View style={styles.full}>{aside}</View> : null}
      {footer ? <View style={styles.full}>{footer}</View> : null}
    </View>
  );
}

function resolveBoardWidth(
  split: boolean,
  planned: number,
  aside: number,
  gap: number,
  turnRow: number,
  boxW: number,
  boxH: number,
): number {
  if (!split) return Math.max(220, Math.min(planned, boxW));
  const byHeight = boxH - turnRow;
  const byWidth = boxW - gap - aside;
  return Math.max(240, Math.round(Math.min(planned, byHeight, byWidth)));
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  stack: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
  },
  full: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  board: {
    maxWidth: '100%',
    flexShrink: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  side: {
    flexShrink: 1,
    minWidth: 0,
  },
});
