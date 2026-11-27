import { Stack } from 'expo-router';

import { AccountScreen } from '@/src/components/auth/AccountScreen';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/account');
}

export default function AccountRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Account', headerBackTitle: 'Back' }} />
      <AccountScreen />
    </>
  );
}
