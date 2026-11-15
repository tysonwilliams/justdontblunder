import { Stack } from 'expo-router';

import { AuthCallbackScreen } from '@/src/components/auth/AuthCallbackScreen';

export default function AuthCallbackRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Signing in', headerBackTitle: 'Back' }} />
      <AuthCallbackScreen />
    </>
  );
}
