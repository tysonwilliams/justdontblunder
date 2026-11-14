import { Text } from 'react-native';

import { liveA11y } from '@/src/components/ui/a11y';
import { text } from '@/src/components/ui/text';

export function AccountNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={text.body} testID="account-status" {...liveA11y()}>
      {message}
    </Text>
  );
}
