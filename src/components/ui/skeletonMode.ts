/** Screenshot and preview hook. `?skeleton=1` shows the loading placeholders. */
export function forceSkeleton(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('skeleton') === '1';
  } catch {
    return false;
  }
}
