import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { PIECE_DOTS, PIECE_PATHS, type PieceKind } from '@/src/components/Board/piecePaths';

export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

/** Chess.com Neo–adjacent palette (original styling, not their assets). */
const NEO = {
  whiteFill: '#F1F1F1',
  whiteStroke: '#5A5A5A',
  whiteDetail: '#5A5A5A',
  blackFill: '#3C3C3C',
  blackStroke: '#101010',
  blackDetail: '#D8D8D8',
  blackHole: '#101010',
} as const;

type Props = {
  code: PieceCode;
  size: number;
};

export function Piece({ code, size }: Props) {
  const isWhite = code.startsWith('w');
  const kind = code.slice(1) as PieceKind;
  const paths = PIECE_PATHS[kind];
  const dots = PIECE_DOTS[kind];

  const fill = isWhite ? NEO.whiteFill : NEO.blackFill;
  const stroke = isWhite ? NEO.whiteStroke : NEO.blackStroke;
  const detail = isWhite ? NEO.whiteDetail : NEO.blackDetail;
  const hole = isWhite ? NEO.whiteStroke : NEO.blackHole;
  const strokeWidth = isWhite ? 1.55 : 1.35;

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 45 45">
        {paths.map((layer, index) =>
          layer.role === 'body' ? (
            <Path
              key={`p-${index}`}
              d={layer.d}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <Path
              key={`p-${index}`}
              d={layer.d}
              fill="none"
              stroke={detail}
              strokeWidth={isWhite ? 1.45 : 1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
        {dots.map((dot, index) => {
          if (dot.role === 'hole') {
            return <Circle key={`d-${index}`} cx={dot.cx} cy={dot.cy} r={dot.r} fill={hole} />;
          }
          if (dot.role === 'detail') {
            return (
              <Circle
                key={`d-${index}`}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={isWhite ? NEO.whiteStroke : NEO.blackDetail}
              />
            );
          }
          return (
            <Circle
              key={`d-${index}`}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          );
        })}
      </Svg>
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
});
