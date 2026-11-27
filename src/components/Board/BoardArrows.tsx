import { memo } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Polygon } from 'react-native-svg';

import { centerOf, labelAnchor } from '@/src/components/Board/boardCoords';
import type { BoardArrow } from '@/src/components/Board/boardTypes';
import { fonts, markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';

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

  // Track destination collisions so two labeled arrows ending on the same square never cover each other.
  const destTotals = new Map<string, number>();
  for (const arrow of arrows) {
    if (!arrow.label) continue;
    destTotals.set(arrow.to, (destTotals.get(arrow.to) ?? 0) + 1);
  }
  const destSeen = new Map<string, number>();

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
        const totalOnDest = destTotals.get(arrow.to) ?? 1;
        const slot = destSeen.get(arrow.to) ?? 0;
        destSeen.set(arrow.to, slot + 1);
        const at =
          totalOnDest > 1
            ? midpointAnchor(
                centerOf(arrow.from, orientation, squareSize),
                centerOf(arrow.to, orientation, squareSize),
                slot,
                badge,
                inner,
              )
            : labelAnchor(arrow.to, orientation, squareSize);
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

function midpointAnchor(
  from: { x: number; y: number },
  to: { x: number; y: number },
  slot: number,
  badge: number,
  boardPx: number,
): { x: number; y: number } {
  const t = 0.46;
  const rawX = from.x + (to.x - from.x) * t + (slot === 0 ? -badge * 0.15 : badge * 0.15);
  const rawY = from.y + (to.y - from.y) * t;
  const pad = badge * 0.6;
  return {
    x: Math.max(pad, Math.min(boardPx - pad, rawX)),
    y: Math.max(pad, Math.min(boardPx - pad, rawY)),
  };
}

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
  const startX = from.x + ux * square * 0.3;
  const startY = from.y + uy * square * 0.3;
  const tipX = to.x - ux * square * 0.16;
  const tipY = to.y - uy * square * 0.16;
  const head = square * 0.3;
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  const px = -uy;
  const py = ux;
  const halfShaft = Math.max(3, Math.min(11, square * 0.085));
  const wing = head * 0.58;
  const points = `${tipX},${tipY} ${baseX + px * wing},${baseY + py * wing} ${baseX - px * wing},${baseY - py * wing}`;
  return (
    <G opacity={0.82}>
      <Polygon
        points={`${startX + px * halfShaft},${startY + py * halfShaft} ${baseX + px * halfShaft},${baseY + py * halfShaft} ${baseX - px * halfShaft},${baseY - py * halfShaft} ${startX - px * halfShaft},${startY - py * halfShaft}`}
        fill={color}
      />
      <Polygon points={points} fill={color} />
    </G>
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
