import { Stack } from 'expo-router';

import { DeleteAccount } from '@/src/components/legal/DeleteAccount';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/delete-account');
}

export default function DeleteAccountRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Delete data', headerBackTitle: 'Back' }} />
      <DeleteAccount />
    </>
  );
}
