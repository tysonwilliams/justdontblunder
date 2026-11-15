import type { OAuthProviderId } from '@/src/auth/types';

export type ProviderAvailability = 'on' | 'off' | 'unknown';

export type OAuthAvailability = {
  google: ProviderAvailability;
  apple: ProviderAvailability;
};

const UNKNOWN: OAuthAvailability = { google: 'unknown', apple: 'unknown' };

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
