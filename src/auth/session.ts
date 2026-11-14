import { create } from 'zustand';

import { authFrom } from '@/src/auth/supabaseAuth';
import { getSupabase } from '@/src/data/supabase';

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
  try {
    return getSupabase() !== null;
  } catch {
    return false;
  }
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
  let client: ReturnType<typeof getSupabase>;
  try {
    client = getSupabase();
  } catch {
    client = null;
  }
  if (!client) {
    useAccountStore.setState({ phase: 'guest', configured: false, user: null });
    return () => undefined;
  }
  useAccountStore.setState({ configured: true });
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    useAccountStore.setState({
      phase: user ? 'signed-in' : 'guest',
      configured: true,
      user: user ? identityFromUser(user) : null,
    });
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

export async function signOutCurrentAccount(): Promise<'signed-out' | 'failed' | 'guest'> {
  const client = getSupabase();
  if (!client) return 'guest';
  const { error } = await authFrom(client).signOut();
  return error ? 'failed' : 'signed-out';
}

function metadataName(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  const full = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
  if (full) return full;
  const display = typeof metadata.display_name === 'string' ? metadata.display_name.trim() : '';
  return display || null;
}
