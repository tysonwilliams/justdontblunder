import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/src/theme';

export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

const GLYPHS: Record<PieceCode, string> = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
};

type Props = {
  code: PieceCode;
  size: number;
};

export function Piece({ code, size }: Props) {
  const isWhite = code.startsWith('w');
  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <Text
        style={[
          styles.glyph,
          {
            fontSize: size * 0.72,
            color: isWhite ? colors.whitePiece : colors.blackPiece,
            textShadowColor: isWhite ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)',
          },
        ]}>
        {GLYPHS[code]}
      </Text>
    </View>
  );
}

export function pieceCodeFrom(color: 'w' | 'b', type: string): PieceCode {
  return `${color}${type.toUpperCase()}` as PieceCode;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontFamily: fonts.display,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
