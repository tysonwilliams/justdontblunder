import { memo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { centerOf, labelAnchor } from '@/src/components/Board/boardCoords';
import type { BoardArrow } from '@/src/components/Board/boardTypes';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts } from '@/src/theme';

type Props = {
  arrows: readonly BoardArrow[];
  orientation: 'white' | 'black';
  squareSize: number;
};

export const BoardArrows = memo(function BoardArrows({ arrows, orientation, squareSize }: Props) {
  const { colors, scheme } = useTheme();
  if (!arrows.length || squareSize <= 0) return null;
  const inner = squareSize * 8;
  const fallback = markColor('danger', scheme, colors);

  return (
    <>
      <Svg pointerEvents="none" width={inner} height={inner} style={styles.arrows} viewBox={`0 0 ${inner} ${inner}`}>
        {arrows.map((arrow) => (
          <ArrowShape
            key={`${arrow.from}${arrow.to}${arrow.label ?? ''}`}
            from={centerOf(arrow.from, orientation, squareSize)}
            to={centerOf(arrow.to, orientation, squareSize)}
            color={arrow.color ?? fallback}
            square={squareSize}
          />
        ))}
      </Svg>
      {arrows.map((arrow) => {
        if (!arrow.label) return null;
        const badge = Math.max(22, Math.min(32, squareSize * 0.34));
        const at = labelAnchor(arrow.to, orientation, squareSize);
        return (
          <View
            key={`label-${arrow.from}${arrow.to}${arrow.label}`}
            pointerEvents="none"
            style={[
              styles.arrowLabel,
              {
                width: badge,
                height: badge,
                borderRadius: badge / 2,
                left: at.x - badge / 2,
                top: at.y - badge / 2,
                borderColor: arrow.color ?? fallback,
              },
            ]}>
            <Text style={[styles.arrowLabelText, { color: arrow.color ?? fallback, fontSize: badge * 0.48 }]}>
              {arrow.label}
            </Text>
          </View>
        );
      })}
    </>
  );
});

function ArrowShape({
  from,
  to,
  color,
  square,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  square: number;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const startX = from.x + ux * square * 0.28;
  const startY = from.y + uy * square * 0.28;
  const tipX = to.x - ux * square * 0.18;
  const tipY = to.y - uy * square * 0.18;
  const head = square * 0.28;
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  const px = -uy;
  const py = ux;
  const wing = head * 0.55;
  const points = `${tipX},${tipY} ${baseX + px * wing},${baseY + py * wing} ${baseX - px * wing},${baseY - py * wing}`;
  return (
    <>
      <Polygon
        points={`${startX + px * 3},${startY + py * 3} ${baseX + px * 3},${baseY + py * 3} ${baseX - px * 3},${baseY - py * 3} ${startX - px * 3},${startY - py * 3}`}
        fill={color}
        opacity={0.95}
      />
      <Polygon points={points} fill={color} />
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  arrows: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 4,
  },
  arrowLabel: {
    position: 'absolute',
    zIndex: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLabelText: {
    fontFamily: fonts.bodyExtra,
    textAlign: 'center',
  },
}));
