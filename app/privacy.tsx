import { Stack } from 'expo-router';

import { PrivacyPolicy } from '@/src/components/legal/PrivacyPolicy';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/privacy');
}

export default function PrivacyRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy', headerBackTitle: 'Back' }} />
      <PrivacyPolicy />
    </>
  );
}
