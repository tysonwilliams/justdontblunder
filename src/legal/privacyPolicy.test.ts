import { describe, expect, it } from 'vitest';

import { OWNER_CONTACT_PLACEHOLDER, privacyPolicyText } from '@/src/legal/privacyPolicy';

describe('privacy policy', () => {
  const policy = privacyPolicyText();

  it('states how guests, accounts, chess sites, and hosting work', () => {
    expect(policy).toContain('Effective November 14, 2026.');
    expect(policy).toContain('no account');
    expect(policy).toContain('this browser or on this device');
    expect(policy).toContain('Optional accounts are coming soon');
    expect(policy).toContain('email magic link or Google sign-in');
    expect(policy).toContain('Supabase');
    expect(policy).toContain('United States (region us-west-2)');
    expect(policy).toContain('display name and timezone');
    expect(policy).toContain('Linked Chess.com and Lichess usernames');
    expect(policy).toContain('Scanned game ids, not the full games');
    expect(policy).toContain('Drills');
    expect(policy).toContain('Review history');
    expect(policy).toContain('Attempts');
    expect(policy).toContain('Streak days');
    expect(policy).toContain('your browser fetches public games directly from Chess.com or Lichess');
    expect(policy).toContain('never asks for a chess-site password');
    expect(policy).toContain('There are no ads. We do not sell your data.');
    expect(policy).toContain('hosted on Vercel');
    expect(policy).toContain('scan cursor');
  });

  it('leaves a marked contact placeholder and does not claim a certification', () => {
    expect(policy).toContain('Placeholder. The owner still needs to add this before accounts launch.');
    expect(policy).toContain(OWNER_CONTACT_PLACEHOLDER);
    expect(policy).not.toMatch(/\S+@\S+/);
    expect(policy).not.toMatch(/GDPR|CCPA|COPPA|HIPAA|SOC\s*2|certified|certification|compliant/i);
  });
});
