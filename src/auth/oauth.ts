import { oauthFailedMessage, oauthUnavailableMessage, providerUnavailable } from '@/src/auth/messages';
import { authCallbackUrl } from '@/src/auth/redirect';
import type { AuthApi, OAuthProviderId } from '@/src/auth/types';

export type WebOAuthRequest = {
  transport: 'web-redirect';
  provider: OAuthProviderId;
  redirectTo: string;
};

/**
 * Native iOS later: AuthenticationServices (or expo-apple-authentication) returns
 * an identity token, and this transport passes it to signInWithIdToken.
 * The web button never builds this request. Android keeps using the web redirect.
 */
export type NativeAppleRequest = {
  transport: 'native-id-token';
  provider: 'apple';
  identityToken: string;
  nonce?: string;
  fullName?: AppleName | null;
};

export type AppleName = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
};

export type OAuthRequest = WebOAuthRequest | NativeAppleRequest;

export type OAuthResult =
  | { status: 'redirecting' }
  | { status: 'signed-in' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

export function webProviderRequest(provider: OAuthProviderId, origin: string): WebOAuthRequest {
  return { transport: 'web-redirect', provider, redirectTo: authCallbackUrl(origin) };
}

export function nativeAppleRequest(credential: {
  identityToken: string;
  nonce?: string;
  fullName?: AppleName | null;
}): NativeAppleRequest {
  return {
    transport: 'native-id-token',
    provider: 'apple',
    identityToken: credential.identityToken,
    nonce: credential.nonce,
    fullName: credential.fullName,
  };
}

export function appleDisplayName(fullName: AppleName | null | undefined): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  return parts.join(' ');
}

export async function startOAuthSignIn(api: AuthApi, request: OAuthRequest): Promise<OAuthResult> {
  switch (request.transport) {
    case 'web-redirect':
      return startWebRedirect(api, request);
    case 'native-id-token':
      return startNativeApple(api, request);
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

async function startWebRedirect(api: AuthApi, request: WebOAuthRequest): Promise<OAuthResult> {
  const { error } = await api.signInWithOAuth({
    provider: request.provider,
    redirectTo: request.redirectTo,
  });
  if (!error) return { status: 'redirecting' };
  if (providerUnavailable(error.message)) {
    return { status: 'unavailable', message: oauthUnavailableMessage(request.provider) };
  }
  return { status: 'error', message: oauthFailedMessage() };
}

async function startNativeApple(api: AuthApi, request: NativeAppleRequest): Promise<OAuthResult> {
  if (!request.identityToken) return { status: 'error', message: oauthFailedMessage() };
  const { error } = await api.signInWithIdToken({
    token: request.identityToken,
    nonce: request.nonce,
  });
  if (error) {
    if (providerUnavailable(error.message)) {
      return { status: 'unavailable', message: oauthUnavailableMessage('apple') };
    }
    return { status: 'error', message: oauthFailedMessage() };
  }
  const name = appleDisplayName(request.fullName);
  if (name) {
    const data: Record<string, string> = { full_name: name };
    const given = request.fullName?.givenName?.trim();
    const family = request.fullName?.familyName?.trim();
    if (given) data.given_name = given;
    if (family) data.family_name = family;
    await api.updateUserData({ data });
  }
  return { status: 'signed-in' };
}
