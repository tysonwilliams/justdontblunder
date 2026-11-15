import { Stack } from 'expo-router';

import { AccountScreen } from '@/src/components/auth/AccountScreen';

export default function AccountRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Account', headerBackTitle: 'Back' }} />
      <AccountScreen />
    </>
  );
}
