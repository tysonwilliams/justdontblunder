/**
 * Supabase hashes the raw nonce with SHA-256 (lowercase hex) and compares it
 * to the nonce claim in Google's ID token. Google Identity Services receives
 * the hash. signInWithIdToken receives the raw nonce.
 * https://supabase.com/docs/guides/auth/social-login/auth-google
 */

export type GoogleNonce = {
  raw: string;
  hashed: string;
};

const NONCE_BYTES = 32;

export function rawNonceFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

export function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export async function hashGoogleNonce(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return hex(new Uint8Array(digest));
}

export async function createGoogleNonce(bytes: Uint8Array = randomNonceBytes()): Promise<GoogleNonce> {
  const raw = rawNonceFromBytes(bytes);
  const hashed = await hashGoogleNonce(raw);
  return { raw, hashed };
}

function randomNonceBytes(): Uint8Array {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}
