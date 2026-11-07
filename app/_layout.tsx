import 'react-native-gesture-handler';
import {
  Nunito_500Medium,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useThemePreference } from '@/src/store/themePreference';
import { useTheme } from '@/src/theme/useTheme';
import { applyDocumentTheme } from '@/src/theme/chrome';
import type { Theme } from '@/src/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function useThemeReady(): boolean {
  const [ready, setReady] = useState(() => {
    if (Platform.OS === 'web') return true;
    return useThemePreference.persist.hasHydrated();
  });

  useEffect(() => {
    if (useThemePreference.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useThemePreference.persist.onFinishHydration(() => setReady(true));
  }, []);

  return ready;
}

function useThemeChrome(theme: Theme) {
  useEffect(() => {
    applyDocumentTheme(theme.scheme, theme.colors);
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme]);
}

export default function RootLayout() {
  const theme = useTheme();
  const themeReady = useThemeReady();
  useThemeChrome(theme);
  const { colors } = theme;
  const [loaded, error] = useFonts({
    Nunito_500Medium,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && themeReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, themeReady]);

  if (!loaded || !themeReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
