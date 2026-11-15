/** Where Supabase may send the browser after email or OAuth. Exact allow-list entries. */
export function authCallbackUrl(origin: string): string {
  return `${trimOrigin(origin)}/auth/callback`;
}

export function passwordUpdateUrl(origin: string): string {
  return `${trimOrigin(origin)}/auth/update-password`;
}

export function browserOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const origin = window.location?.origin;
  if (!origin || origin === 'null') return null;
  return origin;
}

/** Query plus hash, so a code, token hash, or implicit session is visible either way. */
export function browserAuthSearch(): string {
  if (typeof window === 'undefined') return '';
  const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search;
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (search && hash) return `${search}&${hash}`;
  return search || hash;
}

/** Drop a one-time code or hash session from the address bar after it has been read. */
export function clearAuthSearch(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '/';
  window.history.replaceState(window.history.state, '', path);
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}
