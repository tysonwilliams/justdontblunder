import { Text, View } from 'react-native';

import { coordinateMarks, type BoardOrientation } from '@/src/components/Board/coordinates';
import { useTheme } from '@/src/theme/useTheme';
import { fonts } from '@/src/theme/tokens';

type Props = {
  orientation: BoardOrientation;
  squareSize: number;
};

export function BoardCoordinates({ orientation, squareSize }: Props) {
  const { colors } = useTheme();
  if (squareSize <= 0) return null;
  const marks = coordinateMarks(orientation, squareSize);
  const fontSize = Math.max(10, Math.min(14, Math.round(squareSize * 0.16)));

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 6 }}>
      {marks.map((mark) => {
        const file = mark.square.charCodeAt(0) - 97;
        const rank = Number(mark.square[1]);
        const dark = (file + rank) % 2 === 1;
        return (
          <View
            key={`${mark.corner}-${mark.square}`}
            style={{
              position: 'absolute',
              left: mark.left,
              top: mark.top,
              width: mark.size,
              height: mark.size,
              overflow: 'hidden',
              alignItems: mark.corner === 'file' ? 'flex-end' : 'flex-start',
              justifyContent: mark.corner === 'file' ? 'flex-end' : 'flex-start',
            }}>
            <Text
              style={{
                color: dark ? colors.boardCoordOnDark : colors.boardCoordOnLight,
                fontFamily: fonts.bodyBold,
                fontSize,
                lineHeight: fontSize + 1,
              }}>
              {mark.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
