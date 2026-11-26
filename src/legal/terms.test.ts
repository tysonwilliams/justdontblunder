import { describe, expect, it } from 'vitest';

import { SUPPORT_EMAIL } from '@/src/legal/contact';
import { termsText } from '@/src/legal/terms';

describe('terms', () => {
  const terms = termsText();

  it('names the site, the date, the contact, and the privacy policy', () => {
    expect(terms).toContain('Effective November 26, 2026.');
    expect(terms).toContain('justdontblunder.com');
    expect(terms).toContain(SUPPORT_EMAIL);
    expect(terms).toContain('play stays open with no account');
    expect(terms).toContain('email magic link');
    expect(terms).toContain('email and password');
    expect(terms).toContain('Google and Apple');
    expect(terms).toContain('We never ask for a password on those sites, and we never send one.');
    expect(terms).toContain('Privacy');
    expect(terms).toContain('Delete data');
    expect(terms).toContain('It is practice.');
    expect(terms).not.toMatch(/GDPR|CCPA|COPPA|HIPAA|SOC\s*2|certified|certification|compliant/i);
  });
});
