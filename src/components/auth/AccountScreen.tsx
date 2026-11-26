import { Link, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { AccountNotice } from '@/src/components/auth/AccountNotice';
import { AuthField } from '@/src/components/auth/AuthField';
import { useBusyAction } from '@/src/components/auth/useBusyAction';
import { AboutFooter } from '@/src/components/legal/AboutFooter';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { startOAuthSignIn, webProviderRequest, type OAuthResult } from '@/src/auth/oauth';
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithEmailPassword,
  signUpWithPassword,
  type PasswordResult,
} from '@/src/auth/password';
import { enabledOAuthProviders, loadOAuthAvailability, shownOAuthProviders } from '@/src/auth/providers';
import { authCallbackUrl, browserOrigin, passwordUpdateUrl } from '@/src/auth/redirect';
import { signOutCurrentAccount, useAccountStore } from '@/src/auth/session';
import { authFrom } from '@/src/auth/supabaseAuth';
import type { OAuthProviderId } from '@/src/auth/types';
import { getSupabase, getSupabasePublicConfig } from '@/src/data/supabase';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, spacing } from '@/src/theme';

type Mode = 'sign-in' | 'create' | 'forgot';

const PRIVACY_HREF = '/privacy' as Href;
const TERMS_HREF = '/terms' as Href;
const DELETE_HREF = '/delete-account' as Href;

export function AccountScreen() {
  useTheme();
  const phase = useAccountStore((state) => state.phase);
  const configured = useAccountStore((state) => state.configured);
  const label = useAccountStore((state) => state.user?.label ?? null);

  if (phase === 'loading') {
    return (
      <Frame>
        <Text style={text.body}>Checking this device…</Text>
      </Frame>
    );
  }

  if (!configured) {
    return (
      <Frame>
        <Text style={text.body}>
          Play is open on this device. Sign-in isn't available in this build, and nothing here is blocked.
        </Text>
        <AboutFooter showProgressLink />
      </Frame>
    );
  }

  if (phase === 'signed-in' && label) {
    return <SignedIn label={label} />;
  }

  return <GuestAccount />;
}

function SignedIn({ label }: { label: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Frame>
      <Text style={text.body} testID="account-signed-in">
        Signed in as {label}
      </Text>
      <Text style={text.muted}>Signing out leaves the copy on this device. Play stays open.</Text>
      <Button
        label="Sign out"
        variant="secondary"
        testID="account-sign-out"
        onPress={() => {
          void signOutCurrentAccount().then((result) => {
            if (result === 'failed') setNotice('Could not sign out. Try again.');
          });
        }}
      />
      <AccountNotice message={notice} />
      <LegalLinks />
      <Link href={DELETE_HREF} testID="account-delete-link" style={styles.link}>
        <Text style={styles.linkText}>Delete account</Text>
      </Link>
      <AboutFooter showProgressLink />
    </Frame>
  );
}

function GuestAccount() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<OAuthProviderId[] | null>(() =>
    enabledOAuthProviders().length === 0 ? [] : null,
  );
  const { busy, run } = useBusyAction();
  const showProviderOffNote = enabledOAuthProviders().length > 0 && providers?.length === 0;

  useEffect(() => {
    const enabled = enabledOAuthProviders();
    if (enabled.length === 0) return;
    const config = getSupabasePublicConfig();
    if (!config) {
      setProviders([]);
      return;
    }
    let live = true;
    void loadOAuthAvailability(config).then((availability) => {
      if (live) setProviders(shownOAuthProviders(availability, enabled));
    });
    return () => {
      live = false;
    };
  }, []);

  const clearSecrets = () => {
    setPassword('');
    setConfirm('');
  };

  const applyPassword = (result: PasswordResult) => {
    switch (result.status) {
      case 'signed-in':
      case 'updated':
        clearSecrets();
        setNotice(null);
        return;
      case 'confirm-email':
      case 'sent':
      case 'invalid':
      case 'error':
        clearSecrets();
        setNotice(result.message);
        return;
      default: {
        const _exhaustive: never = result;
        setNotice(_exhaustive);
      }
    }
  };

  const applyOAuth = (result: OAuthResult) => {
    switch (result.status) {
      case 'redirecting':
      case 'signed-in':
        return;
      case 'unavailable':
      case 'error':
        setNotice(result.message);
        return;
      default: {
        const _exhaustive: never = result;
        setNotice(_exhaustive);
      }
    }
  };

  const withApi = async (work: (api: ReturnType<typeof authFrom>, origin: string) => Promise<void>) => {
    const client = getSupabase();
    const origin = browserOrigin();
    if (!client || !origin) {
      setNotice('Open this page in the browser to continue.');
      return;
    }
    try {
      await work(authFrom(client), origin);
    } catch {
      setNotice("That didn't work. Try again.");
    }
  };

  return (
    <Frame>
      <Text style={text.body}>
        Play stays open without an account. Sign in to keep progress when you use another browser.
      </Text>
      {mode === 'sign-in' ? (
        <View style={styles.form}>
          {providers?.map((provider) => (
            <Button
              key={provider}
              label={providerLabel(provider)}
              variant="secondary"
              testID={provider === 'google' ? 'account-google' : 'account-apple'}
              onPress={() => {
                void run(async () => {
                  await withApi(async (api, origin) => {
                    applyOAuth(await startOAuthSignIn(api, webProviderRequest(provider, origin)));
                  });
                });
              }}
            />
          ))}
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            testID="account-email"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Button
            label={busy ? 'Sending' : 'Email me a link'}
            testID="account-magic"
            onPress={() => {
              void run(async () => {
                await withApi(async (api, origin) => {
                  applyPassword(await sendMagicLink(api, { email, emailRedirectTo: authCallbackUrl(origin) }));
                });
              });
            }}
          />
          <Text style={text.muted}>Or use a password.</Text>
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            testID="account-password"
            secure
            autoComplete="current-password"
            textContentType="password"
          />
          <Button
            label={busy ? 'Signing in' : 'Sign in'}
            variant="secondary"
            testID="account-sign-in"
            onPress={() => {
              void run(async () => {
                await withApi(async (api) => {
                  applyPassword(await signInWithEmailPassword(api, { email, password }));
                });
              });
            }}
          />
          <View style={styles.links}>
            <TextButton label="Create an account" testID="account-create" onPress={() => setMode('create')} />
            <TextButton label="Forgot password" testID="account-forgot" onPress={() => setMode('forgot')} />
          </View>
        </View>
      ) : null}
      {mode === 'create' ? (
        <View style={styles.form}>
          <Text style={text.section}>Create an account</Text>
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            testID="account-email"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            testID="account-password"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <AuthField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            testID="account-confirm"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Button
            label={busy ? 'Creating' : 'Create account'}
            testID="account-sign-up"
            onPress={() => {
              void run(async () => {
                await withApi(async (api, origin) => {
                  applyPassword(
                    await signUpWithPassword(api, {
                      email,
                      password,
                      confirm,
                      emailRedirectTo: authCallbackUrl(origin),
                    }),
                  );
                });
              });
            }}
          />
          <TextButton label="Back to sign in" testID="account-back" onPress={() => setMode('sign-in')} />
        </View>
      ) : null}
      {mode === 'forgot' ? (
        <View style={styles.form}>
          <Text style={text.section}>Reset password</Text>
          <Text style={text.muted}>We'll email a link to choose a new password.</Text>
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            testID="account-email"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Button
            label={busy ? 'Sending' : 'Send a reset link'}
            testID="account-reset"
            onPress={() => {
              void run(async () => {
                await withApi(async (api, origin) => {
                  applyPassword(
                    await sendPasswordReset(api, { email, redirectTo: passwordUpdateUrl(origin) }),
                  );
                });
              });
            }}
          />
          <TextButton label="Back to sign in" testID="account-back" onPress={() => setMode('sign-in')} />
        </View>
      ) : null}
      <AccountNotice message={notice} />
      <LegalLinks />
      <Text style={text.muted}>
        Chess.com and Lichess stay a public username. This password is only for Just Don't Blunder.
      </Text>
      {showProviderOffNote ? (
        <Text style={text.muted} testID="account-providers-off">
          Google and Apple aren't turned on yet. Use email instead.
        </Text>
      ) : null}
      <AboutFooter showProgressLink />
    </Frame>
  );
}

function providerLabel(provider: OAuthProviderId): string {
  switch (provider) {
    case 'google':
      return 'Continue with Google';
    case 'apple':
      return 'Continue with Apple';
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

function LegalLinks() {
  return (
    <View style={styles.links}>
      <Link href={PRIVACY_HREF} testID="account-privacy" style={styles.link}>
        <Text style={styles.linkText}>Privacy</Text>
      </Link>
      <Link href={TERMS_HREF} testID="account-terms" style={styles.link}>
        <Text style={styles.linkText}>Terms</Text>
      </Link>
    </View>
  );
}

function TextButton({ label, testID, onPress }: { label: string; testID: string; onPress: () => void }) {
  return <Button label={label} variant="ghost" fullWidth={false} testID={testID} onPress={onPress} />;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <Screen maxWidth={720}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={text.eyebrow}>Just Don't Blunder</Text>
          <Text style={text.display}>Account</Text>
        </View>
        {children}
      </View>
    </Screen>
  );
}

const styles = themedStyleSheet((colors) => ({
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
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[24],
    color: colors.accent,
  },
}));
