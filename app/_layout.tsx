import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
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
import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BootSkeleton } from '@/src/components/ui/Skeleton';
import { startAccountSession } from '@/src/auth/session';
import { startProgressSync } from '@/src/data/sync/gate';
import { unlockFeedback } from '@/src/feedback/playFeedback';
import { startClientErrorReporting } from '@/src/observability/clientError';
import { useResumeScan } from '@/src/store/useResumeScan';
import { useThemePreference } from '@/src/store/themePreference';
import { useTheme } from '@/src/theme/useTheme';
import { applyDocumentTheme } from '@/src/theme/chrome';
import type { Theme } from '@/src/theme/tokens';

export { ErrorBoundary } from '@/src/observability/AppErrorBoundary';

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
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  // Static HTML is laid out with no viewport. Hydration keeps those inline
  // sizes. Remounting once on web writes the real window into the DOM.
  const [shell, setShell] = useState(0);
  useResumeScan();
  useThemeChrome(theme);
  const { colors } = theme;
  const [, error] = useFonts({
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

  useEffect(() => startAccountSession(), []);
  useEffect(() => startProgressSync(), []);
  useEffect(() => startClientErrorReporting(), []);

  useEffect(() => {
    if (!themeReady) return;
    void SplashScreen.hideAsync();
  }, [themeReady]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.getElementById('boot')?.remove();
    const wantedPath = window.location.pathname;
    const wanted = `${wantedPath}${window.location.search}${window.location.hash}`;
    setShell(1);
    const frame = requestAnimationFrame(() => {
      if (!wantedPath || pathnameRef.current === wantedPath) return;
      router.replace(wanted as Href);
    });
    return () => cancelAnimationFrame(frame);
  }, [router]);

  if (!themeReady) {
    return <BootSkeleton />;
  }

  return (
    <GestureHandlerRootView
      key={shell}
      onPointerDown={unlockFeedback}
      style={{ flex: 1, backgroundColor: colors.background }}>
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
