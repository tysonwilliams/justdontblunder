import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';

import type { BoardSquareModel } from '@/src/components/Board/boardSquares';
import { legalMoveInk } from '@/src/components/Board/highlight';
import { Piece } from '@/src/components/Board/Piece';
import { noteSquareRender } from '@/src/components/Board/squareRenderCount';
import { squareA11y } from '@/src/components/ui/a11y';
import { getActivePalette } from '@/src/theme/active';
import { colors, fonts, radii, spacing } from '@/src/theme/tokens';

type Props = BoardSquareModel & {
  onPress: (square: Square) => void;
};

export const BoardSquare = memo(function BoardSquare({
  square,
  squareSize,
  backgroundColor,
  pieceCode,
  isLegal,
  isDark,
  showFile,
  showRank,
  hidePiece,
  label,
  selected,
  onPress,
}: Props) {
  noteSquareRender(square);
  const palette = getActivePalette();
  const ink = legalMoveInk(isDark, palette);
  const coordColor = isDark ? palette.boardLight : palette.boardDark;
  const coordSize = Math.max(9, Math.min(12, Math.round(squareSize * 0.2)));

  return (
    <Pressable
      {...squareA11y(label, selected)}
      onPress={() => onPress(square)}
      style={[styles.square, { width: squareSize, height: squareSize, backgroundColor }]}>
      {isLegal ? (
        <View
          style={[
            styles.legalDot,
            pieceCode ? styles.legalCapture : null,
            {
              width: squareSize * (pieceCode ? 0.9 : 0.32),
              height: squareSize * (pieceCode ? 0.9 : 0.32),
              backgroundColor: pieceCode ? colors.transparent : ink,
              borderColor: pieceCode ? ink : colors.transparent,
            },
          ]}
        />
      ) : null}
      {pieceCode && !hidePiece ? <Piece code={pieceCode} size={squareSize} /> : null}
      {showFile ? (
        <Text style={[styles.coord, styles.fileCoord, { color: coordColor, fontSize: coordSize, lineHeight: coordSize + 1 }]}>
          {square[0]}
        </Text>
      ) : null}
      {showRank ? (
        <Text style={[styles.coord, styles.rankCoord, { color: coordColor, fontSize: coordSize, lineHeight: coordSize + 1 }]}>
          {square[1]}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  square: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalDot: {
    position: 'absolute',
    borderRadius: radii.pill,
    zIndex: 1,
  },
  legalCapture: {
    backgroundColor: colors.transparent,
    borderWidth: 4,
  },
  coord: {
    position: 'absolute',
    fontFamily: fonts.bodyBold,
  },
  fileCoord: {
    right: spacing[3],
    bottom: spacing[2],
  },
  rankCoord: {
    left: spacing[3],
    top: spacing[2],
  },
});
