import { Pressable, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { controlA11y } from '@/src/components/ui/a11y';
import { IconBoard, IconDrill, IconHome, IconProgress, IconTrain } from '@/src/components/ui/icons';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, layout, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

const ICONS = {
  index: IconHome,
  learn: IconTrain,
  drills: IconDrill,
  practice: IconBoard,
  progress: IconProgress,
} as const;

type IconName = keyof typeof ICONS;

function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

type TabRoute = {
  key: string;
  name: string;
};

type Props = {
  wide: boolean;
  insets: EdgeInsets;
  state: {
    index: number;
    routes: TabRoute[];
  };
  descriptors: Record<string, { options: { title?: string } }>;
  emitter: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
};

export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets, wide }: Props) {
  const { colors } = useTheme();
  const { padX, contentW } = useLayout();

  return (
    <View
      style={[
        wide ? styles.top : styles.bottom,
        wide ? { paddingTop: insets.top } : { paddingBottom: Math.max(insets.bottom, spacing.xs) },
      ]}>
      <View
        style={[
          styles.inner,
          wide && styles.innerWide,
          wide && { paddingHorizontal: padX, maxWidth: contentW + padX * 2 },
        ]}>
        {wide ? (
          <View style={styles.brand}>
            <BrandMark />
            <Text style={styles.brandText}>Just Don't Blunder</Text>
          </View>
        ) : null}
        <View style={[styles.links, wide && styles.linksWide]}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const label = descriptors[route.key]?.options.title ?? route.name;
            const color = focused ? colors.accent : colors.textMuted;
            const Icon = isIconName(route.name) ? ICONS[route.name] : IconHome;

            const onPress = () => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            };

            return (
              <Pressable
                key={route.key}
                {...controlA11y('tab', label, focused)}
                onPress={onPress}
                style={(press) => {
                  const hovered = 'hovered' in press && Boolean(press.hovered);
                  return [
                    wide ? styles.linkWide : styles.link,
                    focused && (wide ? styles.linkWideOn : styles.linkOn),
                    !focused && hovered && styles.linkHover,
                    press.pressed && styles.pressed,
                  ];
                }}>
                {wide ? null : <Icon color={color} size={20} />}
                <Text style={[wide ? styles.labelWide : styles.label, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function BrandMark() {
  return (
    <View style={styles.mark}>
      <View style={styles.markRow}>
        <View style={[styles.sq, styles.sqLight]} />
        <View style={[styles.sq, styles.sqDark]} />
      </View>
      <View style={styles.markRow}>
        <View style={[styles.sq, styles.sqDark]} />
        <View style={[styles.sq, styles.sqLight]} />
      </View>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  top: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: layout.tabBar,
    justifyContent: 'center',
  },
  bottom: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xxs,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  inner: {
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  innerWide: {
    minHeight: layout.tabBar,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    flexShrink: 1,
  },
  mark: {
    width: 18,
    height: 18,
    borderRadius: radii.dot,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  markRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sq: {
    flex: 1,
  },
  sqLight: {
    backgroundColor: colors.boardLight,
  },
  sqDark: {
    backgroundColor: colors.boardDark,
  },
  brandText: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[17],
    lineHeight: lineHeights[22],
    letterSpacing: letterSpacing.tight,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.xxs,
  },
  linksWide: {
    gap: spacing.xs,
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  link: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderRadius: radii.md,
    cursor: 'pointer',
  },
  linkOn: {
    backgroundColor: colors.accentSoft,
  },
  linkWide: {
    minHeight: 40,
    paddingHorizontal: spacing[14],
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  linkWideOn: {
    backgroundColor: colors.accentSoft,
  },
  linkHover: {
    backgroundColor: colors.hover,
  },
  pressed: {
    opacity: 0.78,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[13],
  },
  labelWide: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
  },
}));
