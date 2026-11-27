import { describe, expect, it } from 'vitest';

import {
  DISPLAY_NAME_BLOCKLIST,
  DISPLAY_NAME_LEET_FROM,
  DISPLAY_NAME_LEET_TO,
  checkDisplayName,
  foldDisplayName,
} from '@/src/logic/displayName';

describe('public display names', () => {
  it('accepts a short name and collapses extra space', () => {
    expect(checkDisplayName('  Ada  ')).toEqual({ ok: true, name: 'Ada' });
    expect(checkDisplayName('Ada  Lovelace')).toEqual({ ok: true, name: 'Ada Lovelace' });
    expect(checkDisplayName('Bishop')).toEqual({ ok: true, name: 'Bishop' });
    expect(checkDisplayName('Kshitij')).toEqual({ ok: true, name: 'Kshitij' });
    expect(checkDisplayName('Scunthorpe')).toEqual({ ok: true, name: 'Scunthorpe' });
    expect(checkDisplayName('Hello')).toEqual({ ok: true, name: 'Hello' });
    expect(checkDisplayName('fuku')).toEqual({ ok: true, name: 'fuku' });
  });

  it('rejects length, symbols, an email, and blocked language', () => {
    expect(checkDisplayName('A')).toEqual({ ok: false, message: 'Use 2 to 20 characters.' });
    expect(checkDisplayName('A'.repeat(21))).toEqual({ ok: false, message: 'Use 2 to 20 characters.' });
    expect(checkDisplayName('   ')).toEqual({ ok: false, message: 'Use 2 to 20 characters.' });
    expect(checkDisplayName('ada@example.com')).toEqual({
      ok: false,
      message: 'Use letters, numbers, and spaces.',
    });
    expect(checkDisplayName('cool_name')).toEqual({ ok: false, message: 'Use letters, numbers, and spaces.' });
    expect(checkDisplayName('shit')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('sh1t')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('b1tch')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('oh shit')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('f u c k')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('f0ck')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('fvck')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('phuck')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('ohshit')).toEqual({ ok: false, message: 'Choose a different name.' });
    expect(checkDisplayName('peacock')).toEqual({ ok: false, message: 'Choose a different name.' });
  });

  it('folds leet the same way the migration does', () => {
    expect(DISPLAY_NAME_LEET_FROM.length).toBe(DISPLAY_NAME_LEET_TO.length);
    expect(foldDisplayName('sh1t')).toBe('shit');
    expect(foldDisplayName('B1tch')).toBe('bitch');
    expect(DISPLAY_NAME_BLOCKLIST).toContain('fuck');
    expect(new Set(DISPLAY_NAME_BLOCKLIST).size).toBe(DISPLAY_NAME_BLOCKLIST.length);
  });
});
