import { Pressable, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { StreakBadge } from '@/src/components/StreakBadge';
import { XpChip } from '@/src/components/XpChip';
import { BrandMark } from '@/src/components/ui/BrandMark';
import { controlA11y } from '@/src/components/ui/a11y';
import { IconBoard, IconDrill, IconHome, IconMenu, IconProgress, IconTrain } from '@/src/components/ui/icons';
import { useMenuStore } from '@/src/components/ui/menuState';
import { useScreenInsets } from '@/src/components/ui/screenInsets';
import { useLayout } from '@/src/components/ui/useLayout';
import { dueTodayCount } from '@/src/logic/reviewSchedule';
import { useProgressStore } from '@/src/store/progress';
import { activeDailyStreak } from '@/src/store/slices/training';
import { useHydrated } from '@/src/store/useHydrated';
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
  compactRail?: boolean;
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

export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets, wide, compactRail = false }: Props) {
  const { colors } = useTheme();
  const { padX } = useLayout();
  const screenInsets = useScreenInsets();
  const hydrated = useHydrated(useProgressStore.persist);
  const review = useProgressStore((s) => s.review);
  const dailyStreak = useProgressStore((s) => s.dailyStreak);
  const lastDrillDate = useProgressStore((s) => s.lastDrillDate);
  const openMenu = useMenuStore((s) => s.openMenu);
  const dueCount = hydrated ? dueTodayCount(review) : 0;
  const liveStreak = hydrated ? activeDailyStreak(dailyStreak, lastDrillDate) : 0;

  const top = Math.max(insets.top, screenInsets.top);
  const bottom = Math.max(insets.bottom, screenInsets.bottom);
  const side = Math.max(insets.left, screenInsets.left, insets.right, screenInsets.right);

  const openHome = () => {
    const home = state.routes.find((route) => route.name === 'index');
    if (home && state.routes[state.index]?.key !== home.key) {
      navigateToTab(home.key);
    }
  };

  if (wide) {
    const railWidth = compactRail ? layout.navRailCompact : layout.navRail;
    return (
      <View
        style={[
          styles.rail,
          {
            width: railWidth,
            paddingTop: Math.max(spacing.md, top + spacing.sm),
            paddingBottom: Math.max(spacing.md, bottom + spacing.sm),
          },
        ]}>
        <Pressable
          {...controlA11y('button', "Just Don't Blunder home")}
          {...(compactRail ? ({ title: "Just Don't Blunder" } as Record<string, string>) : undefined)}
          onPress={openHome}
          style={(press) => [
            styles.railBrand,
            compactRail && styles.railBrandCompact,
            press.pressed && styles.pressed,
          ]}>
          <BrandMark size={30} />
          {compactRail ? null : (
            <Text style={styles.brandText} numberOfLines={1}>
              Just Don't Blunder
            </Text>
          )}
        </Pressable>

        <View style={styles.railLinks}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const label = descriptors[route.key]?.options.title ?? route.name;
            const color = focused ? colors.accent : colors.textMuted;
            const Icon = isIconName(route.name) ? ICONS[route.name] : IconHome;
            const badge = route.name === 'drills' && dueCount > 0 ? dueCount : 0;

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
                {...controlA11y('tab', badge ? `${label}, ${badge} due` : label, focused)}
                {...(compactRail ? ({ title: badge ? `${label} (${badge} due)` : label } as Record<string, string>) : undefined)}
                onPress={onPress}
                style={(press) => {
                  const hovered = 'hovered' in press && Boolean(press.hovered);
                  return [
                    styles.railLink,
                    compactRail && styles.railLinkCompact,
                    focused && styles.railLinkOn,
                    !focused && hovered && styles.linkHover,
                    press.pressed && styles.pressed,
                  ];
                }}>
                <View style={styles.iconWrap}>
                  <Icon color={color} size={20} />
                  {compactRail && badge > 0 ? <View style={styles.dueDot} /> : null}
                </View>
                {compactRail ? null : (
                  <Text style={[styles.railLabel, { color }]} numberOfLines={1}>
                    {label}
                  </Text>
                )}
                {!compactRail && badge > 0 ? (
                  <View style={styles.dueBadge}>
                    <Text style={styles.dueBadgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.railFooter, compactRail && styles.railFooterCompact]}>
          {compactRail ? null : (
            <View style={styles.railStats}>
              {liveStreak > 0 ? <StreakBadge streak={liveStreak} compact /> : null}
              <XpChip />
            </View>
          )}
          <Pressable
            {...controlA11y('button', 'Settings')}
            {...(compactRail ? ({ title: 'Settings' } as Record<string, string>) : undefined)}
            testID="open-menu"
            onPress={openMenu}
            style={(press) => {
              const hovered = 'hovered' in press && Boolean(press.hovered);
              return [
                styles.railLink,
                compactRail && styles.railLinkCompact,
                hovered && styles.linkHover,
                press.pressed && styles.pressed,
              ];
            }}>
            <IconMenu color={colors.textMuted} size={20} />
            {compactRail ? null : (
              <Text style={styles.railSettingsHint} numberOfLines={1}>
                Settings
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bottom,
        {
          // tabBarPhone already includes this resting pad. Add the home-indicator inset on top.
          paddingBottom: bottom + spacing.xs,
          paddingLeft: side,
          paddingRight: side,
        },
      ]}>
      <View style={[styles.inner, { paddingHorizontal: padX }]}>
        <View style={styles.links}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const label = descriptors[route.key]?.options.title ?? route.name;
            const color = focused ? colors.accent : colors.textMuted;
            const Icon = isIconName(route.name) ? ICONS[route.name] : IconHome;
            const hasDue = route.name === 'drills' && dueCount > 0;

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
                {...controlA11y('tab', hasDue ? `${label}, ${dueCount} due` : label, focused)}
                onPress={onPress}
                style={(press) => {
                  const hovered = 'hovered' in press && Boolean(press.hovered);
                  return [
                    styles.link,
                    focused && styles.linkOn,
                    !focused && hovered && styles.linkHover,
                    press.pressed && styles.pressed,
                  ];
                }}>
                <View style={styles.iconWrap}>
                  <Icon color={color} size={20} />
                  {hasDue ? <View style={styles.dueDot} /> : null}
                </View>
                <Text style={[styles.label, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  rail: {
    height: '100%',
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing[12],
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  railBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    cursor: 'pointer',
  },
  railBrandCompact: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  brandText: {
    flex: 1,
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    letterSpacing: letterSpacing.tight,
  },
  railLinks: {
    flex: 1,
    gap: spacing[4],
  },
  railLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: spacing[12],
    borderRadius: radii.md,
    cursor: 'pointer',
  },
  railLinkCompact: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  railLinkOn: {
    backgroundColor: colors.accentSoft,
  },
  railLabel: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
  },
  dueBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: spacing[6],
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueBadgeText: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accentText,
  },
  railFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
    gap: spacing[10],
  },
  railFooterCompact: {
    alignItems: 'center',
  },
  railStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: spacing[4],
  },
  railSettingsHint: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    color: colors.textMuted,
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
    justifyContent: 'center',
  },
  links: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.xxs,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
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
}));
