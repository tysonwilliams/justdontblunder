import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { Square } from 'chess.js';

import { squareOrigin } from '@/src/components/Board/boardCoords';
import type { BoardOrientation } from '@/src/components/Board/coordinates';
import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { IconCheck, IconX } from '@/src/components/ui/icons';
import { useTheme } from '@/src/theme/useTheme';

export type MoveBadgeKind = 'safe' | 'blunder';

type Props = {
  square: Square;
  kind: MoveBadgeKind;
  orientation: BoardOrientation;
  squareSize: number;
};

export function MoveBadge({ square, kind, orientation, squareSize }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0.4);
  const size = Math.max(18, Math.min(30, Math.round(squareSize * 0.36)));
  const origin = squareOrigin(square, orientation, squareSize);
  const left = origin.x + squareSize - size - 2;
  const top = Math.max(2, origin.y + 2);

  useEffect(() => {
    scale.value = reduced ? 1 : 0.4;
    scale.value = reduced ? 1 : withSpring(1, { damping: 12, stiffness: 220 });
  }, [kind, left, reduced, scale, square, top]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const backgroundColor = kind === 'safe' ? colors.success : colors.danger;
  const ink = kind === 'safe' ? colors.accentText : colors.onDanger;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 8,
        },
        anim,
      ]}>
      <View pointerEvents="none">
        {kind === 'safe' ? <IconCheck color={ink} size={size * 0.62} /> : <IconX color={ink} size={size * 0.58} />}
      </View>
    </Animated.View>
  );
}
