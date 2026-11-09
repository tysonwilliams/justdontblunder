import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Square } from 'chess.js';

import type { BoardSquareModel } from '@/src/components/Board/boardSquares';
import { legalMoveInk } from '@/src/components/Board/highlight';
import { Piece } from '@/src/components/Board/Piece';
import { noteSquareRender } from '@/src/components/Board/squareRenderCount';
import { squareA11y } from '@/src/components/ui/a11y';
import { getActivePalette } from '@/src/theme/active';
import { colors, radii } from '@/src/theme/tokens';

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
  hidePiece,
  label,
  selected,
  onPress,
}: Props) {
  noteSquareRender(square);
  const palette = getActivePalette();
  const ink = legalMoveInk(isDark, palette);
  const dot = Math.max(10, Math.round(squareSize * 0.26));
  const ring = Math.round(squareSize * 0.86);
  const ringWidth = Math.max(3, Math.round(squareSize * 0.075));

  return (
    <Pressable
      {...squareA11y(label, selected)}
      onPress={() => onPress(square)}
      style={[styles.square, { width: squareSize, height: squareSize, backgroundColor }]}>
      {isLegal && !pieceCode ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (squareSize - dot) / 2,
            top: (squareSize - dot) / 2,
            width: dot,
            height: dot,
            borderRadius: radii.pill,
            backgroundColor: ink,
            zIndex: 2,
          }}
        />
      ) : null}
      {pieceCode && !hidePiece ? <Piece code={pieceCode} size={squareSize} /> : null}
      {isLegal && pieceCode ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (squareSize - ring) / 2,
            top: (squareSize - ring) / 2,
            width: ring,
            height: ring,
            borderRadius: radii.pill,
            borderWidth: ringWidth,
            borderColor: ink,
            backgroundColor: colors.transparent,
            zIndex: 4,
          }}
        />
      ) : null}
      {selected ? <SelectionCorners size={squareSize} color={palette.boardCoordOnLight} /> : null}
    </Pressable>
  );
});

function SelectionCorners({ size, color }: { size: number; color: string }) {
  const arm = Math.max(8, Math.round(size * 0.24));
  const thick = Math.max(2, Math.round(size * 0.07));
  const inset = Math.max(2, Math.round(size * 0.05));
  const corner = (top: boolean, left: boolean) => (
    <View
      key={`${top}-${left}`}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: top ? inset : undefined,
        bottom: top ? undefined : inset,
        left: left ? inset : undefined,
        right: left ? undefined : inset,
        width: arm,
        height: arm,
        borderColor: color,
        borderTopWidth: top ? thick : 0,
        borderBottomWidth: top ? 0 : thick,
        borderLeftWidth: left ? thick : 0,
        borderRightWidth: left ? 0 : thick,
        zIndex: 5,
      }}
    />
  );
  return (
    <>
      {corner(true, true)}
      {corner(true, false)}
      {corner(false, true)}
      {corner(false, false)}
    </>
  );
}

const styles = StyleSheet.create({
  square: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
