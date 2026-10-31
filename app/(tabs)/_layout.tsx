import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { AppTabBar } from '@/src/components/AppTabBar';
import { colors, layout } from '@/src/theme';

const WIDE = layout.nav;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} wide={wide} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarPosition: wide ? 'top' : 'bottom',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
      <Tabs.Screen name="drills" options={{ title: 'Drills' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}
