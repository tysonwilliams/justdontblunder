import { Stack } from 'expo-router';

import { DeleteAccount } from '@/src/components/legal/DeleteAccount';

export default function DeleteAccountRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Delete data', headerBackTitle: 'Back' }} />
      <DeleteAccount />
    </>
  );
}
