import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { layout, spacing } from '@/src/theme';

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

const TURN_ROW = 46;
const MIN_BOARD = 244;

export function boardStageIsWide(width: number): boolean {
  return width >= layout.split;
}

export function BoardStage({ board, aside, intro, footer, asideFirst = false }: Props) {
  const { split, boardWidth, asideWidth, gap, contentHeight, contentW } = useLayout();
  const [introH, setIntroH] = useState(0);
  const [asideH, setAsideH] = useState(0);
  const [footerH, setFooterH] = useState(0);

  const remember = (setter: (value: number) => void) => (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setter(next);
  };

  if (split) {
    const rowWidth = Math.min(contentW, boardWidth + gap + asideWidth);
    return (
      <View style={styles.center}>
        <View style={[styles.row, { width: rowWidth, gap }]}>
          <View style={[styles.board, { width: boardWidth }]}>{board}</View>
          <View style={styles.side}>
            {intro}
            {aside}
            {footer}
          </View>
        </View>
      </View>
    );
  }

  const introMeasured = intro ? introH || 200 : 0;
  const asideMeasured = aside ? asideH || 140 : 0;
  const footerMeasured = footer ? footerH || 168 : 0;
  const blocks = 1 + (intro ? 1 : 0) + (aside ? 1 : 0) + (footer ? 1 : 0);
  const available =
    contentHeight -
    introMeasured -
    asideMeasured -
    footerMeasured -
    Math.max(0, blocks - 1) * spacing.md -
    TURN_ROW -
    8;
  const narrowBoard = Math.round(
    Math.min(contentW, layout.boardMax, Math.max(available, MIN_BOARD)),
  );

  return (
    <View style={styles.stack}>
      {intro ? (
        <View onLayout={remember(setIntroH)} style={styles.full}>
          {intro}
        </View>
      ) : null}
      {aside && asideFirst ? (
        <View onLayout={remember(setAsideH)} style={styles.full}>
          {aside}
        </View>
      ) : null}
      <View style={[styles.board, { width: narrowBoard }]}>{board}</View>
      {aside && !asideFirst ? (
        <View onLayout={remember(setAsideH)} style={styles.full}>
          {aside}
        </View>
      ) : null}
      {footer ? (
        <View onLayout={remember(setFooterH)} style={styles.full}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    width: '100%',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  stack: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
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
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  side: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
});
