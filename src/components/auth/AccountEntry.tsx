import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { text } from '@/src/components/ui/text';
import { signOutCurrentAccount, useAccountStore } from '@/src/auth/session';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { spacing } from '@/src/theme';

const SIGN_OUT_FAILED = 'Could not sign out. Try again.';

/** Small account line for Progress. The form itself lives on /account. */
export function AccountEntry() {
  const router = useRouter();
  useTheme();
  const phase = useAccountStore((state) => state.phase);
  const configured = useAccountStore((state) => state.configured);
  const label = useAccountStore((state) => state.user?.label ?? null);
  const [status, setStatus] = useState<string | null>(null);

  if (phase === 'signed-in' && label) {
    return (
      <View style={styles.row}>
        <Text style={text.muted} testID="progress-account">
          Signed in as {label}
        </Text>
        <Button
          label="Sign out"
          variant="ghost"
          fullWidth={false}
          testID="progress-sign-out"
          onPress={() => {
            void signOutCurrentAccount().then((result) => {
              if (result === 'failed') setStatus(SIGN_OUT_FAILED);
            });
          }}
        />
        {status ? <Text style={text.body}>{status}</Text> : null}
      </View>
    );
  }

  if (phase === 'guest' && configured) {
    return (
      <View style={styles.row}>
        <Text style={text.muted}>Stored on this device. An account is optional.</Text>
        <Button
          label="Sign in"
          variant="secondary"
          fullWidth={false}
          testID="progress-sign-in"
          onPress={() => router.push('/account' as Href)}
        />
      </View>
    );
  }

  return <Text style={text.muted}>Stored on this device.</Text>;
}

const styles = themedStyleSheet(() => ({
  row: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
}));
