import type { OAuthProviderId } from '@/src/auth/types';

/** Public web client id. Missing means the Supabase redirect stays in place. */
export function googleClientId(
  raw: string | null | undefined = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export type GoogleButtonKind = 'hidden' | 'gis' | 'redirect';

/**
 * Google shows only when the build allow-list includes it.
 * The official button is web-only, and only when the public client id is set.
 * iOS, Android, and a missing client id keep signInWithOAuth.
 */
export function googleButtonKind(input: {
  shown: readonly OAuthProviderId[];
  platform: string;
  clientId: string | null | undefined;
}): GoogleButtonKind {
  if (!input.shown.includes('google')) return 'hidden';
  const clientId = typeof input.clientId === 'string' ? input.clientId.trim() : '';
  if (input.platform === 'web' && clientId) return 'gis';
  return 'redirect';
}

export const GOOGLE_BUTTON_MAX_WIDTH = 400;

export function googleButtonWidth(containerWidth: number): number | null {
  if (!Number.isFinite(containerWidth) || containerWidth < 1) return null;
  return Math.min(GOOGLE_BUTTON_MAX_WIDTH, Math.floor(containerWidth));
}

export function googleButtonTheme(scheme: 'dark' | 'light'): 'outline' | 'outline_dark' {
  switch (scheme) {
    case 'dark':
      return 'outline_dark';
    case 'light':
      return 'outline';
    default: {
      const _exhaustive: never = scheme;
      return _exhaustive;
    }
  }
}

export type GoogleButtonOptions = {
  type: 'standard';
  theme: 'outline' | 'outline_dark';
  size: 'large';
  text: 'continue_with';
  shape: 'rectangular';
  logo_alignment: 'left';
  width: number;
  locale: 'en';
};

/** Official button, capped at Google's 400px width, reading "Continue with Google". */
export function googleButtonConfig(scheme: 'dark' | 'light', containerWidth: number): GoogleButtonOptions | null {
  const width = googleButtonWidth(containerWidth);
  if (width === null) return null;
  return {
    type: 'standard',
    theme: googleButtonTheme(scheme),
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width,
    locale: 'en',
  };
}

export type GoogleCredentialResponse = {
  credential?: string;
};

export type GoogleIdentityConfig = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce: string;
  use_fedcm_for_prompt: true;
  use_fedcm_for_button: true;
  auto_select: false;
  button_auto_select: false;
  itp_support: true;
  context: 'signin';
  ux_mode: 'popup';
};

/** Hashed nonce goes to Google. The callback receives the ID token, not the raw nonce. */
export function googleIdentityConfig(input: {
  clientId: string;
  hashedNonce: string;
  onCredential: (credential: string) => void;
}): GoogleIdentityConfig {
  return {
    client_id: input.clientId,
    nonce: input.hashedNonce,
    callback: (response) => {
      if (!response.credential) return;
      input.onCredential(response.credential);
    },
    use_fedcm_for_prompt: true,
    use_fedcm_for_button: true,
    auto_select: false,
    button_auto_select: false,
    itp_support: true,
    context: 'signin',
    ux_mode: 'popup',
  };
}

export type GoogleIdentityClient = {
  initialize: (config: GoogleIdentityConfig) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
};

export function paintGoogleButton(
  google: GoogleIdentityClient,
  parent: HTMLElement,
  options: GoogleButtonOptions,
): void {
  parent.replaceChildren();
  google.renderButton(parent, options);
}
