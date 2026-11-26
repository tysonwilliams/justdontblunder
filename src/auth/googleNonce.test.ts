import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createGoogleNonce, hashGoogleNonce, rawNonceFromBytes } from '@/src/auth/googleNonce';

describe('google nonce', () => {
  it('builds the raw nonce the way the Supabase guide does', () => {
    const bytes = Uint8Array.from([0, 1, 2, 255, 32, 127]);
    expect(rawNonceFromBytes(bytes)).toBe(btoa(String.fromCharCode(...bytes)));
  });

  it('hashes the raw nonce as lowercase SHA-256 hex', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const nonce = await createGoogleNonce(bytes);
    const hashed = createHash('sha256').update(nonce.raw).digest('hex');
    expect(nonce.raw).toBe(rawNonceFromBytes(bytes));
    expect(nonce.hashed).toBe(hashed);
    expect(await hashGoogleNonce(nonce.raw)).toBe(hashed);
    expect(nonce.hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce.hashed).not.toBe(nonce.raw);
  });

  it('hashes a known string', async () => {
    expect(await hashGoogleNonce('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('returns a hash of a generated raw nonce', async () => {
    const nonce = await createGoogleNonce();
    expect(nonce.hashed).toBe(createHash('sha256').update(nonce.raw).digest('hex'));
  });
});
