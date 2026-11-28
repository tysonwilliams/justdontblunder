import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '@/src/polyfills/url';
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => startAccountSession(), []);
  useEffect(() => startProgressSync(), []);
  useEffect(() => startClientErrorReporting(), []);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      process.env.NODE_ENV !== 'production' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    void SplashScreen.hideAsync();
  }, [themeReady]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const events: (keyof WindowEventMap)[] = ['pointerup', 'touchend', 'click', 'keydown'];
    const listener = () => unlockFeedback();
    for (const type of events) window.addEventListener(type, listener, { passive: true });
    return () => {
      for (const type of events) window.removeEventListener(type, listener);
    };
  }, []);

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
