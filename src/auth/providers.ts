import type { OAuthProviderId } from '@/src/auth/types';

export type ProviderAvailability = 'on' | 'off' | 'unknown';

export type OAuthAvailability = {
  google: ProviderAvailability;
  apple: ProviderAvailability;
};

const UNKNOWN: OAuthAvailability = { google: 'unknown', apple: 'unknown' };

const OAUTH_PROVIDER_IDS: readonly OAuthProviderId[] = ['google', 'apple'];

/**
 * Build-time allow-list from EXPO_PUBLIC_OAUTH_PROVIDERS.
 * Unset, blank, and unknown names show no button. Order follows the list.
 */
export function enabledOAuthProviders(
  raw: string | undefined = process.env.EXPO_PUBLIC_OAUTH_PROVIDERS,
): OAuthProviderId[] {
  if (!raw?.trim()) return [];
  const seen = new Set<OAuthProviderId>();
  const enabled: OAuthProviderId[] = [];
  for (const part of raw.split(',')) {
    const token = part.trim().toLowerCase();
    if (!isOAuthProviderId(token) || seen.has(token)) continue;
    seen.add(token);
    enabled.push(token);
  }
  return enabled;
}

/**
 * Show a provider unless Auth says it is off.
 * A failed settings read keeps the button, and the click explains a missing provider.
 */
export function visibleOAuthProviders(availability: OAuthAvailability): OAuthProviderId[] {
  const visible: OAuthProviderId[] = [];
  if (availability.google !== 'off') visible.push('google');
  if (availability.apple !== 'off') visible.push('apple');
  return visible;
}

/**
 * Buttons the account screen may render.
 * The build-time list is the gate. Auth settings still hide a listed provider that is off.
 */
export function shownOAuthProviders(
  availability: OAuthAvailability,
  enabled: readonly OAuthProviderId[] = enabledOAuthProviders(),
): OAuthProviderId[] {
  const open = new Set(visibleOAuthProviders(availability));
  return enabled.filter((provider) => open.has(provider));
}

function isOAuthProviderId(value: string): value is OAuthProviderId {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(value);
}

export function parseOAuthAvailability(body: unknown): OAuthAvailability {
  if (!body || typeof body !== 'object') return UNKNOWN;
  const external = (body as { external?: unknown }).external;
  if (!external || typeof external !== 'object') return UNKNOWN;
  const record = external as { google?: unknown; apple?: unknown };
  return {
    google: availability(record.google),
    apple: availability(record.apple),
  };
}

export async function loadOAuthAvailability(
  config: { url: string; anonKey: string },
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<OAuthAvailability> {
  try {
    const response = await fetchImpl(`${config.url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    if (!response.ok) return UNKNOWN;
    return parseOAuthAvailability(await response.json());
  } catch {
    return UNKNOWN;
  }
}

function availability(value: unknown): ProviderAvailability {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return 'unknown';
}
