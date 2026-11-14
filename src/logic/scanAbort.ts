/** Stop a scan without looking like a site failure. Fetch aborts use the same name. */
export function abortError(): Error {
  const error = new Error('Scan paused.');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { name?: unknown }).name === 'AbortError';
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
