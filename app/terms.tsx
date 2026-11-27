import { Stack } from 'expo-router';

import { TermsOfService } from '@/src/components/legal/TermsOfService';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/terms');
}

export default function TermsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Terms', headerBackTitle: 'Back' }} />
      <TermsOfService />
    </>
  );
}
