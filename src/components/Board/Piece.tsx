import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { pieceCodeFrom, type PieceCode } from '@/src/components/Board/pieceCode';
import { PIECE_SVG } from '@/src/components/Board/pieceSvgs';

export type { PieceCode };
export { pieceCodeFrom };

type Props = {
  code: PieceCode;
  size: number;
};

/** Classic digital chess pieces (Cburnett / Lichess standard set). */
export function Piece({ code, size }: Props) {
  const pad = size * 0.03;
  const draw = size - pad * 2;

  return (
    <View style={[styles.wrap, { width: size, height: size, padding: pad }]} pointerEvents="none">
      <SvgXml xml={PIECE_SVG[code]} width={draw} height={draw} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
