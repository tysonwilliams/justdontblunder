import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/src/theme';

export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

// Use filled glyphs for both colors so white pieces stay solid on light squares.
const GLYPHS: Record<PieceCode, string> = {
  wK: '♚',
  wQ: '♛',
  wR: '♜',
  wB: '♝',
  wN: '♞',
  wP: '♟',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
};

/** Dark outline offsets so white pieces stay readable on light squares. */
const STROKE_OFFSETS = [
  [-1.5, 0],
  [1.5, 0],
  [0, -1.5],
  [0, 1.5],
  [-1.2, -1.2],
  [1.2, -1.2],
  [-1.2, 1.2],
  [1.2, 1.2],
] as const;

type Props = {
  code: PieceCode;
  size: number;
};

export function Piece({ code, size }: Props) {
  const isWhite = code.startsWith('w');
  const fontSize = size * 0.72;
  const glyph = GLYPHS[code];

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {isWhite
        ? STROKE_OFFSETS.map(([dx, dy], index) => (
            <Text
              key={index}
              style={[
                styles.glyph,
                styles.strokeLayer,
                {
                  fontSize,
                  color: colors.whitePieceStroke,
                  transform: [{ translateX: dx }, { translateY: dy }],
                },
              ]}>
              {glyph}
            </Text>
          ))
        : null}
      <Text
        style={[
          styles.glyph,
          styles.fillLayer,
          {
            fontSize,
            color: isWhite ? colors.whitePiece : colors.blackPiece,
            textShadowColor: isWhite ? 'transparent' : 'rgba(255,255,255,0.35)',
            textShadowRadius: isWhite ? 0 : 2,
            textShadowOffset: isWhite ? { width: 0, height: 0 } : { width: 0, height: 1 },
          },
        ]}>
        {glyph}
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
    textAlign: 'center',
  },
  strokeLayer: {
    position: 'absolute',
  },
  fillLayer: {
    position: 'absolute',
  },
});
