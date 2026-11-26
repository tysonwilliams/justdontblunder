import { Stack } from 'expo-router';

import { TermsOfService } from '@/src/components/legal/TermsOfService';

export default function TermsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Terms', headerBackTitle: 'Back' }} />
      <TermsOfService />
    </>
  );
}
