import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { IconBoard, IconDrill, IconHome, IconProgress, IconTrain } from '@/src/components/ui/icons';
import { colors, fonts } from '@/src/theme';

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
  return (
    <View
      style={[
        wide ? styles.top : styles.bottom,
        wide ? { paddingTop: insets.top } : { paddingBottom: Math.max(insets.bottom, 8) },
      ]}>
      <View style={[styles.inner, wide && styles.innerWide]}>
        {wide ? (
          <View style={styles.brand}>
            <View style={styles.mark} />
            <Text style={styles.brandText}>Just Don't Blunder</Text>
          </View>
        ) : null}
        <View style={[styles.links, wide && styles.linksWide]}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const label = descriptors[route.key]?.options.title ?? route.name;
            const color = focused ? colors.accent : colors.textDim;
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
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                style={(press) => [
                  wide ? styles.linkWide : styles.link,
                  focused && wide && styles.linkWideOn,
                  press.pressed && styles.pressed,
                ]}>
                {wide ? null : <Icon color={color} />}
                <Text style={[wide ? styles.labelWide : styles.label, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottom: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inner: {
    minHeight: 58,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  innerWide: {
    minHeight: 64,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  brandText: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
  },
  linksWide: {
    gap: 4,
    justifyContent: 'flex-end',
  },
  link: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    cursor: 'pointer',
  },
  linkWide: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    cursor: 'pointer',
  },
  linkWideOn: {
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  labelWide: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
