import { Stack } from 'expo-router';

import { UpdatePasswordScreen } from '@/src/components/auth/UpdatePasswordScreen';
import { privateMetadata } from '@/src/seo/site';

export function generateMetadata() {
  return privateMetadata(
    '/auth/update-password',
    "New password · Just Don't Blunder",
    "Choose a new password for Just Don't Blunder.",
  );
}

export default function UpdatePasswordRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'New password', headerBackTitle: 'Back' }} />
      <UpdatePasswordScreen />
    </>
  );
}
