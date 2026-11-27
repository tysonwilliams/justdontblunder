import { describe, expect, it } from 'vitest';

import { SUPPORT_EMAIL } from '@/src/legal/contact';
import { privacyPolicyText } from '@/src/legal/privacyPolicy';

describe('privacy policy', () => {
  const policy = privacyPolicyText();

  it('names the site, the date, and a real contact address', () => {
    expect(policy).toContain('Effective November 26, 2026.');
    expect(policy).toContain('justdontblunder.com');
    expect(policy).toContain(SUPPORT_EMAIL);
    expect(policy).toContain('Just Don\'t Blunder runs justdontblunder.com.');
    expect(policy).not.toContain("[add the owner's contact email here]");
    expect(policy).not.toContain('Placeholder. The owner still needs to add a contact email.');
    expect(policy).not.toMatch(/GDPR|CCPA|COPPA|HIPAA|SOC\s*2|certified|certification|compliant/i);
  });

  it('describes guest play and the local storage keys', () => {
    expect(policy).toContain('with no account');
    expect(policy).toContain('on this device, in this browser');
    expect(policy).toContain(
      'your streak, your best Streak run, XP, finished lessons, drill counts, the review schedule',
    );
    expect(policy).toContain('scan cursor');
    expect(policy).toContain('jdb-progress-v1');
    expect(policy).toContain('jdb-theme-v1');
    expect(policy).toContain('jdb-feedback-v1');
    expect(policy).toContain('jdb-account-prompt-v1');
    expect(policy).toContain('jdb-implicit-email');
    expect(policy).toContain('access token and the refresh token');
    expect(policy).toContain('does not set an advertising cookie or an analytics cookie');
  });

  it('describes email, Google, and Apple sign-in', () => {
    expect(policy).toContain('Email magic link.');
    expect(policy).toContain('Email and password.');
    expect(policy).toContain('openid, email, and profile scopes');
    expect(policy).toContain('Google account ID');
    expect(policy).toContain('profile picture URL');
    expect(policy).toContain('does not show the profile picture');
    expect(policy).toContain('Google API Services User Data Policy, including the Limited Use requirements');
    expect(policy).toContain('We do not sell it.');
    expect(policy).toContain('We do not use it for advertising.');
    expect(policy).toContain('Apple sign-in');
    expect(policy).toContain('private relay address');
    expect(policy).toContain('given name, and the family name');
    expect(policy).toContain('Supabase Auth, hosted in the United States (region us-west-2)');
  });

  it('describes public chess imports and the synced tables', () => {
    expect(policy).toContain('We never ask for a password on Chess.com or Lichess, and we never send one.');
    expect(policy).toContain('public games only');
    expect(policy).toContain('profiles table');
    expect(policy).toContain('linked_accounts');
    expect(policy).toContain('scanned_games');
    expect(policy).toContain('user_drills');
    expect(policy).toContain('positions table');
    expect(policy).toContain('review_entries');
    expect(policy).toContain('attempts table');
    expect(policy).toContain('does not add a row for each move');
    expect(policy).toContain('daily_streaks');
    expect(policy).toContain('leaderboard_names');
    expect(policy).toContain('streak_scores');
    expect(policy).toContain('public display name');
    expect(policy).toContain('does not show your email');
    expect(policy).toContain('Monday at 00:00 UTC');
    expect(policy).toContain('off until you turn it on');
    expect(policy).toContain('leaderboard name and scores');
    expect(policy).toContain('your best Streak run');
    expect(policy).toContain('puzzles table');
    expect(policy).toContain('Any signed-in player can read it.');
  });

  it('names the processors and says there is no analytics product', () => {
    expect(policy).toContain('Vercel hosts justdontblunder.com');
    expect(policy).toContain('Resend, in the United States (region us-east-1)');
    expect(policy).toContain('Open tracking and click tracking are off');
    expect(policy).toContain('does not include an analytics product');
    expect(policy).toContain('There are no ads. We do not sell your data.');
    expect(policy).toContain('IP address');
    expect(policy).toContain('client_errors');
    expect(policy).toContain('does not include an account id');
    expect(policy).toContain('EXPO_PUBLIC_ERROR_REPORTING is the string true');
    expect(policy).toContain('jdb-error-reports-v1');
    expect(policy).toContain('jdb-onboarding-prompt');
    expect(policy).toContain('not copied into the client_errors row');
  });

  it('covers retention, deletion, children, rights, security, and changes', () => {
    expect(policy).toContain('delete_my_account');
    expect(policy).toContain('Shared positions already stored without your account id are not removed');
    expect(policy).toContain('child under 13');
    expect(policy).toContain('ask for a copy of the personal data');
    expect(policy).toContain('to correct it, or to delete it');
    expect(policy).toContain('served over HTTPS');
    expect(policy).toContain('refuses a service-role key');
    expect(policy).toContain('This version is effective November 26, 2026.');
  });
});
