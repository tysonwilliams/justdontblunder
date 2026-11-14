import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { AccountNotice } from '@/src/components/auth/AccountNotice';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { finishAuthCallback, parseAuthQuery, shareAuthAttempt } from '@/src/auth/callback';
import { browserAuthSearch, clearAuthSearch } from '@/src/auth/redirect';
import { authFrom } from '@/src/auth/supabaseAuth';
import { getSupabase } from '@/src/data/supabase';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { spacing } from '@/src/theme';

export function AuthCallbackScreen() {
  const router = useRouter();
  useTheme();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setMessage('Sign-in is not available in this build.');
      return;
    }
    const search = browserAuthSearch();
    let live = true;
    void shareAuthAttempt(`callback:${search}`, () => finishAuthCallback(authFrom(client), parseAuthQuery(search)))
      .then((result) => {
        if (!live) return;
        clearAuthSearch();
        if (result.status === 'ready') {
          router.replace(result.next as Href);
          return;
        }
        setMessage(result.message);
      })
      .catch(() => {
        if (!live) return;
        setMessage('This sign-in link is incomplete or has expired. Request a new one from the account page.');
      });
    return () => {
      live = false;
    };
  }, [router]);

  return (
    <Screen maxWidth={720}>
      <View style={styles.page}>
        <Text style={text.display}>Signing in</Text>
        <AccountNotice message={message} />
        <Button
          label="Back to account"
          variant="secondary"
          testID="callback-account"
          onPress={() => router.replace('/account' as Href)}
        />
      </View>
    </Screen>
  );
}

const styles = themedStyleSheet(() => ({
  page: {
    width: '100%',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
}));
