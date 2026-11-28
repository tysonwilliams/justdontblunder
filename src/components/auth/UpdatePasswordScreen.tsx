import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { AccountNotice } from '@/src/components/auth/AccountNotice';
import { AuthField } from '@/src/components/auth/AuthField';
import { useBusyAction } from '@/src/components/auth/useBusyAction';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { openPasswordUpdate, parseAuthQuery, shareAuthAttempt } from '@/src/auth/callback';
import { changePassword } from '@/src/auth/password';
import { browserAuthSearch, clearAuthSearch } from '@/src/auth/redirect';
import { loadSupabaseAuth } from '@/src/data/supabaseLazy';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { spacing } from '@/src/theme';

type Phase = 'checking' | 'ready' | 'missing' | 'error';

const EXPIRED = 'This reset link has expired. Request a new one.';

export function UpdatePasswordScreen() {
  const router = useRouter();
  useTheme();
  const [phase, setPhase] = useState<Phase>('checking');
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, run } = useBusyAction();

  useEffect(() => {
    const search = browserAuthSearch();
    let live = true;
    void loadSupabaseAuth()
      .then((api) => {
        if (!live) return;
        if (!api) {
          setPhase('missing');
          setNotice('Sign-in is not available in this build.');
          return;
        }
        return shareAuthAttempt(`password:${search}`, () => openPasswordUpdate(api, parseAuthQuery(search))).then(
          (result) => {
            if (search) clearAuthSearch();
            if (!live) return;
            switch (result.status) {
              case 'ready':
                setPhase('ready');
                return;
              case 'missing':
                setPhase('missing');
                setNotice(EXPIRED);
                return;
              case 'error':
                setPhase('error');
                setNotice(result.message);
                return;
              default: {
                const _exhaustive: never = result;
                setNotice(_exhaustive);
              }
            }
          },
        );
      })
      .catch(() => {
        if (search) clearAuthSearch();
        if (!live) return;
        setPhase('error');
        setNotice(EXPIRED);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Screen maxWidth={720}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={text.eyebrow}>Just Don't Blunder</Text>
          <Text style={text.display}>New password</Text>
        </View>
        {phase === 'checking' ? <Text style={text.body}>Checking the link…</Text> : null}
        {phase === 'ready' ? (
          <View style={styles.form}>
            <Text style={text.body}>Choose a new password for this account.</Text>
            <AuthField
              label="New password"
              value={password}
              onChangeText={setPassword}
              testID="update-password"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <AuthField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              testID="update-password-confirm"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Button
              label={busy ? 'Saving' : 'Save password'}
              testID="update-password-save"
              onPress={() => {
                void run(async () => {
                  const api = await loadSupabaseAuth();
                  if (!api) return;
                  try {
                    const result = await changePassword(api, { password, confirm });
                    switch (result.status) {
                      case 'updated':
                      case 'signed-in':
                        router.replace('/progress' as Href);
                        return;
                      case 'confirm-email':
                      case 'sent':
                      case 'invalid':
                      case 'error':
                        setNotice(result.message);
                        return;
                      default: {
                        const _exhaustive: never = result;
                        setNotice(_exhaustive);
                      }
                    }
                  } catch {
                    setNotice("That didn't work. Try again.");
                  }
                });
              }}
            />
          </View>
        ) : null}
        {phase === 'missing' || phase === 'error' ? (
          <Button
            label="Request a new link"
            variant="secondary"
            testID="update-password-request"
            onPress={() => router.replace('/account' as Href)}
          />
        ) : null}
        <AccountNotice message={phase === 'checking' ? null : notice} />
      </View>
    </Screen>
  );
}

const styles = themedStyleSheet(() => ({
  page: {
    width: '100%',
    gap: spacing[20],
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing[6],
  },
  form: {
    gap: spacing.sm,
  },
}));
