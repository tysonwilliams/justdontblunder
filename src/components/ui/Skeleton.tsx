import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { skeletonPulseMs } from '@/src/components/ui/skeletonMotion';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { layout, radii, spacing } from '@/src/theme';

type BoneProps = {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Bone({ width = '100%', height, radius = radii.sm, style }: BoneProps) {
  const { colors } = useTheme();
  const pulse = usePulseStyle();
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.skeleton,
        },
        pulse,
        style,
      ]}
    />
  );
}

function usePulseStyle() {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    const ms = skeletonPulseMs(reduced);
    if (ms === 0) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.5, { duration: ms }), -1, true);
  }, [opacity, reduced]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/** Square board frame in the same slot the live board uses. */
export function BoardSkeleton({ size, hideTurn = false }: { size?: number; hideTurn?: boolean }) {
  const { colors } = useTheme();
  const { phone, turnRow } = useLayout();
  const pulse = usePulseStyle();
  const frame = size && size > 0 ? Math.round(size) : undefined;
  const rows = [];
  for (let rank = 0; rank < 8; rank += 1) {
    const squares = [];
    for (let file = 0; file < 8; file += 1) {
      const light = (rank + file) % 2 === 0;
      squares.push(
        <View
          key={`${file}${rank}`}
          style={{ flex: 1, backgroundColor: light ? colors.boardLight : colors.boardDark }}
        />,
      );
    }
    rows.push(
      <View key={rank} style={{ flex: 1, flexDirection: 'row' }}>
        {squares}
      </View>,
    );
  }

  return (
    <View accessibilityLabel="Loading board" style={{ width: '100%' }}>
      {hideTurn ? null : (
        <View style={{ height: turnRow, justifyContent: 'center' }}>
          <Bone width={112} height={phone ? 14 : 16} />
        </View>
      )}
      <Animated.View
        style={[
          {
            width: '100%',
            height: frame,
            aspectRatio: frame ? undefined : 1,
            borderWidth: 2,
            borderColor: colors.boardFrame,
            borderRadius: radii.sm,
            overflow: 'hidden',
            backgroundColor: colors.boardFrameBg,
          },
          pulse,
        ]}>
        {rows}
      </Animated.View>
    </View>
  );
}

/** Intro, board, and side copy in the same stack as a play screen. */
export function PlaySkeleton({
  toolbar,
  cards = false,
  hideTurn = false,
}: {
  toolbar?: ReactNode;
  cards?: boolean;
  hideTurn?: boolean;
}) {
  const { phone, tight, split } = useLayout();
  const guide = (
    <View style={[play.guide, phone && styles.guidePhone]}>
      <Bone height={phone ? 14 : 16} />
      <Bone width="78%" height={phone ? 14 : 16} />
    </View>
  );

  return (
    <PlayFrame
      intro={
        <BoardLead>
          {toolbar}
          <View style={play.metaRow}>
            <Bone width={phone ? 88 : 108} height={phone ? 22 : 28} radius={radii.pill} />
            <Bone width={phone ? 64 : 84} height={phone ? 14 : 16} />
          </View>
          <Bone height={phone ? 4 : 6} radius={radii.track} />
          <Bone width={phone ? '74%' : 240} height={phone ? 22 : 30} />
          {tight ? null : <Bone width="86%" height={phone ? 14 : 18} />}
          {tight ? null : <Bone width="70%" height={phone ? 14 : 16} />}
        </BoardLead>
      }
      board={<BoardSkeleton hideTurn={hideTurn} />}
      aside={tight ? null : guide}
      footer={
        cards ? (
          <View style={split ? styles.cardStack : styles.cardRow}>
            <View style={styles.card}>
              <Bone height={phone ? 48 : 84} radius={radii.lg} />
            </View>
            <View style={styles.card}>
              <Bone height={phone ? 48 : 84} radius={radii.lg} />
            </View>
            <View style={styles.card}>
              <Bone height={phone ? 48 : 84} radius={radii.lg} />
            </View>
          </View>
        ) : null
      }
    />
  );
}

/** Fonts and theme are still loading. Matches the tab shell plus the home board. */
export function BootSkeleton() {
  const { colors } = useTheme();
  const { topNav } = useLayout();
  const bar = (
    <View
      style={{
        height: topNav ? layout.tabBar : layout.tabBarPhone,
        backgroundColor: colors.surface,
        borderTopWidth: topNav ? 0 : 1,
        borderBottomWidth: topNav ? 1 : 0,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.md,
      }}>
      {['home', 'learn', 'drills', 'practice', 'progress'].map((id) => (
        <Bone key={id} width={topNav ? 72 : 40} height={topNav ? 16 : 28} radius={radii.md} />
      ))}
    </View>
  );

  return (
    <View accessibilityLabel="Loading" style={{ flex: 1, backgroundColor: colors.background }}>
      {topNav ? bar : null}
      <View style={{ flex: 1 }}>
        <PlaySkeleton cards />
      </View>
      {topNav ? null : bar}
    </View>
  );
}

const styles = {
  guidePhone: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  cardRow: {
    width: '100%' as const,
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  cardStack: {
    width: '100%' as const,
    gap: spacing.sm,
  },
  card: {
    flex: 1,
  },
};
