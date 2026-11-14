import { Stack } from 'expo-router';

import { UpdatePasswordScreen } from '@/src/components/auth/UpdatePasswordScreen';

export default function UpdatePasswordRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'New password', headerBackTitle: 'Back' }} />
      <UpdatePasswordScreen />
    </>
  );
}
