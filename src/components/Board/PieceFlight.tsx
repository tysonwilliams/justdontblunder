import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { squareOrigin } from '@/src/components/Board/boardCoords';
import { SLIDE_MS, type BoardMotion } from '@/src/components/Board/boardMotion';
import { Piece } from '@/src/components/Board/Piece';
import { pieceCodeFrom } from '@/src/components/Board/pieceCode';

export type PieceFlightModel = {
  id: string;
  motion: BoardMotion;
};

type Props = {
  flight: PieceFlightModel;
  orientation: 'white' | 'black';
  squareSize: number;
  onDone: (id: string) => void;
};

function flightOpacity(motion: BoardMotion, t: number): number {
  'worklet';
  if (motion.kind === 'slide') return 1;
  switch (motion.direction) {
    case 'out':
      return 1 - t;
    case 'in':
      return t;
    default: {
      const _exhaustive: never = motion.direction;
      return _exhaustive;
    }
  }
}

/** One piece sliding between squares, or a capture fading in or out. */
export function PieceFlight({ flight, orientation, squareSize, onDone }: Props) {
  const progress = useSharedValue(0);
  const live = useRef(true);
  const motion = flight.motion;
  const fromSquare = motion.kind === 'slide' ? motion.from : motion.square;
  const toSquare = motion.kind === 'slide' ? motion.to : motion.square;
  const from = squareOrigin(fromSquare, orientation, squareSize);
  const to = squareOrigin(toSquare, orientation, squareSize);
  const code = pieceCodeFrom(motion.color, motion.type);

  useEffect(() => {
    live.current = true;
    const finish = () => {
      if (!live.current) return;
      live.current = false;
      onDone(flight.id);
    };
    // If the UI-thread callback never arrives, the destination square must not stay empty.
    const backup = setTimeout(finish, SLIDE_MS + 80);
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finish)();
    });
    return () => {
      live.current = false;
      clearTimeout(backup);
      cancelAnimation(progress);
    };
  }, [flight.id, onDone, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: flightOpacity(motion, t),
      transform: [
        { translateX: from.x + (to.x - from.x) * t },
        { translateY: from.y + (to.y - from.y) * t },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.piece, { width: squareSize, height: squareSize, zIndex: motion.kind === 'fade' ? 12 : 18 }, style]}>
      <Piece code={code} size={squareSize} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
