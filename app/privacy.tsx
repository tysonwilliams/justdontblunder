import { Stack } from 'expo-router';

import { PrivacyPolicy } from '@/src/components/legal/PrivacyPolicy';

export default function PrivacyRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy', headerBackTitle: 'Back' }} />
      <PrivacyPolicy />
    </>
  );
}
