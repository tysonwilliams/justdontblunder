import { Chess } from 'chess.js';
import { View } from 'react-native';

import { Piece } from '@/src/components/Board/Piece';
import { pieceCodeFrom } from '@/src/components/Board/pieceCode';
import type { BoardOrientation } from '@/src/components/Board/coordinates';
import { useTheme } from '@/src/theme/useTheme';
import { radii } from '@/src/theme/tokens';

type Props = {
  fen: string;
  size: number;
  orientation?: BoardOrientation;
};

export function MiniBoard({ fen, size, orientation = 'white' }: Props) {
  const { colors } = useTheme();
  const square = size / 8;
  let rows;
  try {
    rows = new Chess(fen).board();
  } catch {
    rows = new Chess().board();
  }
  if (orientation === 'black') {
    rows = [...rows].reverse().map((row) => [...row].reverse());
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.sm,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.boardFrame,
      }}>
      {rows.map((row, rankIndex) => (
        <View key={rankIndex} style={{ flexDirection: 'row', height: square }}>
          {row.map((piece, fileIndex) => {
            const file = orientation === 'white' ? fileIndex : 7 - fileIndex;
            const rank = orientation === 'white' ? 8 - rankIndex : rankIndex + 1;
            const dark = (file + rank) % 2 === 1;
            return (
              <View
                key={`${rankIndex}-${fileIndex}`}
                style={{
                  width: square,
                  height: square,
                  backgroundColor: dark ? colors.boardDark : colors.boardLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {piece ? <Piece code={pieceCodeFrom(piece.color, piece.type)} size={square} /> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
