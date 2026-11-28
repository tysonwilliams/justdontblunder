import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APP_VERSION,
  allowClientError,
  clientErrorRequest,
  clientRoute,
  isErrorReportingEnabled,
  prepareClientError,
  reportClientError,
  resetClientErrorReporterForTests,
  scrubClientText,
} from '@/src/observability/clientError';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('client errors', () => {
  beforeEach(() => {
    resetClientErrorReporterForTests();
  });

  it('stays off unless the flag is exactly true', () => {
    expect(isErrorReportingEnabled(undefined)).toBe(false);
    expect(isErrorReportingEnabled('')).toBe(false);
    expect(isErrorReportingEnabled('false')).toBe(false);
    expect(isErrorReportingEnabled('TRUE')).toBe(false);
    expect(isErrorReportingEnabled('1')).toBe(false);
    expect(isErrorReportingEnabled('true')).toBe(true);
  });

  it('keeps the row to message, stack, route, version, and platform', () => {
    const row = prepareClientError({
      error: new Error('Failed for ada@example.com at 203.0.113.8 Bearer secret.token'),
      route: '/drills?token=abc#hash',
      version: '0.1.0',
      platform: 'web',
    });
    expect(row).toEqual({
      message: 'Failed for [email] at [ip] Bearer [token]',
      stack: expect.stringContaining('clientError.test.ts'),
      route: '/drills',
      app_version: '0.1.0',
      platform: 'web',
    });
    expect(row?.stack).not.toContain('ada@example.com');
    expect(JSON.stringify(row)).not.toContain('user_id');
    expect(prepareClientError({ error: 'nope', route: '/drills', version: '0.1.0', platform: 'windows' })).toBeNull();
    expect(clientRoute('/account?email=ada@example.com')).toBe('/account');
    expect(clientRoute('https://evil.example/privacy')).toBeNull();
  });

  it('scrubs tokens and ids out of a stack', () => {
    const text = scrubClientText(
      'see eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature and 11111111-1111-4111-8111-111111111111 at https://justdontblunder.com/drills?x=1',
      4000,
    );
    expect(text).not.toContain('eyJ');
    expect(text).not.toContain('11111111');
    expect(text).toContain('https://justdontblunder.com/drills');
    expect(text).not.toContain('?x=1');
  });

  it('rate limits repeats and caps a tab', () => {
    const storage = memoryStorage();
    expect(allowClientError('same', 1_000, storage)).toBe(true);
    expect(allowClientError('same', 1_500, storage)).toBe(false);
    expect(allowClientError('same', 61_000, storage)).toBe(true);
    resetClientErrorReporterForTests();
    const capped = memoryStorage();
    for (let index = 0; index < 8; index += 1) {
      expect(allowClientError(`row-${index}`, index, capped)).toBe(true);
    }
    expect(allowClientError('row-9', 100_000, capped)).toBe(false);
  });

  it('posts with the anon key and does not attach an account', async () => {
    const sent: unknown[] = [];
    reportClientError(new Error('board exploded'), {
      enabled: true,
      route: '/drills',
      now: 10,
      storage: memoryStorage(),
      version: '0.1.0',
      platform: 'ios',
      send: async (row) => {
        sent.push(row);
      },
    });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const request = clientErrorRequest(
      { url: 'https://example.supabase.co/', anonKey: 'sb_publishable_test' },
      sent[0] as {
        message: string;
        stack: string | null;
        route: string | null;
        app_version: string;
        platform: 'ios';
      },
    );
    expect(request.url).toBe('https://example.supabase.co/rest/v1/client_errors');
    expect(request.headers.Authorization).toBe('Bearer sb_publishable_test');
    expect(request.headers.apikey).toBe('sb_publishable_test');
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['app_version', 'message', 'platform', 'route', 'stack']);
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('ip');
  });

  it('does not send when the flag is off', () => {
    const send = vi.fn();
    reportClientError(new Error('nope'), { enabled: false, send, storage: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps APP_VERSION aligned with package.json without bundling package.json', () => {
    const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});
