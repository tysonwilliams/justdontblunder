/**
 * Public leaderboard names. The same list and leet fold live in
 * supabase/migrations/20261126233215_streak_leaderboard.sql.
 * A name is 2 to 20 letters, numbers, and single spaces. The board never shows an email.
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

export const DISPLAY_NAME_LEET_FROM = '013457@$!';
export const DISPLAY_NAME_LEET_TO = 'oieastasi';

export const DISPLAY_NAME_BLOCKLIST = [
  'asshole',
  'bitch',
  'cock',
  'cunt',
  'dick',
  'faggot',
  'fck',
  'fock',
  'fuck',
  'fuk',
  'fvck',
  'nazi',
  'nigga',
  'nigger',
  'phuck',
  'piss',
  'pussy',
  'retard',
  'shit',
  'slut',
  'twat',
  'whore',
] as const;

const SHAPE = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;

export type DisplayNameCheck = { ok: true; name: string } | { ok: false; message: string };

export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function foldDisplayName(value: string): string {
  let folded = '';
  for (const char of value.toLowerCase()) {
    const index = DISPLAY_NAME_LEET_FROM.indexOf(char);
    folded += index === -1 ? char : DISPLAY_NAME_LEET_TO[index];
  }
  return folded;
}

/** True when the normalized name hits the blocklist, including spaced and leet forms. */
export function displayNameBlocked(name: string): boolean {
  const folded = foldDisplayName(name);
  const tokens = folded.split(' ');
  const compact = folded.replace(/ /g, '');
  for (const word of DISPLAY_NAME_BLOCKLIST) {
    for (const token of tokens) {
      if (token === word) return true;
      if (word.length >= 4 && (token.startsWith(word) || token.endsWith(word))) return true;
    }
    if (compact === word) return true;
    if (word.length >= 4 && (compact.startsWith(word) || compact.endsWith(word))) return true;
  }
  return false;
}

export function checkDisplayName(raw: string): DisplayNameCheck {
  const name = normalizeDisplayName(raw);
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    return { ok: false, message: 'Use 2 to 20 characters.' };
  }
  if (!SHAPE.test(name)) return { ok: false, message: 'Use letters, numbers, and spaces.' };
  if (displayNameBlocked(name)) return { ok: false, message: 'Choose a different name.' };
  return { ok: true, name };
}
