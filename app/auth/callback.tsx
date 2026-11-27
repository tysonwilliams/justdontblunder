import { Stack } from 'expo-router';

import { AuthCallbackScreen } from '@/src/components/auth/AuthCallbackScreen';
import { privateMetadata } from '@/src/seo/site';

export function generateMetadata() {
  return privateMetadata('/auth/callback', "Signing in · Just Don't Blunder", 'Finishing sign-in. Play stays open with no account.');
}

export default function AuthCallbackRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Signing in', headerBackTitle: 'Back' }} />
      <AuthCallbackScreen />
    </>
  );
}
