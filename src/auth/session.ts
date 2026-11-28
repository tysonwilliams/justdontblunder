import { create } from 'zustand';

import { getSupabasePublicConfig } from '@/src/data/supabaseConfig';
import { loadSupabase } from '@/src/data/supabaseLazy';

export type AccountPhase = 'loading' | 'guest' | 'signed-in';

export type AccountIdentity = {
  id: string;
  email: string | null;
  label: string;
};

type AccountState = {
  phase: AccountPhase;
  configured: boolean;
  user: AccountIdentity | null;
};

export const useAccountStore = create<AccountState>(() => ({
  phase: 'loading',
  configured: false,
  user: null,
}));

export function accountsConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

/** Display only. Authorization stays on the Supabase session, never on this label. */
export function identityFromUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AccountIdentity {
  const email = user.email?.trim() || null;
  return {
    id: user.id,
    email,
    label: email ?? metadataName(user.user_metadata) ?? 'your account',
  };
}

/**
 * Restores a saved session and follows sign-in and sign-out.
 * Missing config leaves the player as a guest. This does not sync progress.
 */
export function startAccountSession(): () => void {
  if (!getSupabasePublicConfig()) {
    useAccountStore.setState({ phase: 'guest', configured: false, user: null });
    return () => undefined;
  }
  useAccountStore.setState({ configured: true });
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  void loadSupabase()
    .then((client) => {
      if (stopped) return;
      if (!client) {
        useAccountStore.setState({ phase: 'guest', configured: false, user: null });
        return;
      }
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const user = session?.user;
        useAccountStore.setState({
          phase: user ? 'signed-in' : 'guest',
          configured: true,
          user: user ? identityFromUser(user) : null,
        });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })
    .catch(() => {
      if (!stopped) {
        useAccountStore.setState({ phase: 'guest', configured: false, user: null });
      }
    });
  return () => {
    stopped = true;
    unsubscribe?.();
    unsubscribe = null;
  };
}

export async function signOutCurrentAccount(): Promise<'signed-out' | 'failed' | 'guest'> {
  const client = await loadSupabase();
  if (!client) return 'guest';
  const { error } = await client.auth.signOut();
  return error ? 'failed' : 'signed-out';
}

function metadataName(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  const full = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
  if (full) return full;
  const display = typeof metadata.display_name === 'string' ? metadata.display_name.trim() : '';
  return display || null;
}
