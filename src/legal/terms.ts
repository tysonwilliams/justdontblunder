import { sectionText, type LegalSection } from '@/src/legal/blocks';
import { SUPPORT_EMAIL } from '@/src/legal/contact';

export const TERMS_EFFECTIVE_DATE = 'November 26, 2026';

export const PRIVACY_HREF = '/privacy';

export const DELETE_DATA_HREF = '/delete-account';

export const termsIntro =
  'These terms cover the Just Don\'t Blunder chess trainer at justdontblunder.com. Using the site means you agree to them.';

export const termsSections: readonly LegalSection[] = [
  {
    heading: 'The trainer',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Just Don\'t Blunder is practice for spotting a blunder before you play it. You can play, learn, and drill with no account. An account is optional, and play stays open with no account.',
      },
    ],
  },
  {
    heading: 'Accounts',
    blocks: [
      {
        kind: 'paragraph',
        text: 'You can sign in with an email magic link or with email and password. Google and Apple appear when that build turns them on. You are responsible for the email address and the password you choose. The password is only for Just Don\'t Blunder.',
      },
      {
        kind: 'paragraph',
        text: 'You can sign out from the account page. Signing out leaves the copy on this device. You can delete the account, and the progress stored on this device, from the delete page.',
      },
      { kind: 'link', href: DELETE_DATA_HREF, label: 'Delete data', testID: 'terms-delete-link' },
    ],
  },
  {
    heading: 'Chess sites and pasted games',
    blocks: [
      {
        kind: 'paragraph',
        text: 'A Chess.com or Lichess import uses a public username. We never ask for a password on those sites, and we never send one. Paste a game you are allowed to use. Your browser reads the public games from the site you name.',
      },
    ],
  },
  {
    heading: 'Using the site',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Use the trainer for your own practice. Do not try to break the site, disrupt it, or open someone else\'s account. Do not send a Chess.com or Lichess password.',
      },
    ],
  },
  {
    heading: 'Your data',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The privacy policy says what we collect, what an account syncs, and how deletion works.',
      },
      { kind: 'link', href: PRIVACY_HREF, label: 'Privacy', testID: 'terms-privacy-link' },
    ],
  },
  {
    heading: 'Practice, not a promise',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The trainer marks a blunder or a save from the position on the board. It is practice. It is not a promise about a rating or a later game.',
      },
    ],
  },
  {
    heading: 'Changes',
    blocks: [
      {
        kind: 'paragraph',
        text: `We may update these terms. The date at the top of this page will change. This version is effective ${TERMS_EFFECTIVE_DATE}.`,
      },
    ],
  },
  {
    heading: 'Contact',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Email us about these terms.',
      },
      { kind: 'mail', email: SUPPORT_EMAIL, testID: 'terms-support-email' },
    ],
  },
];

export function termsText(): string {
  return [`Effective ${TERMS_EFFECTIVE_DATE}.`, termsIntro, ...sectionText(termsSections)].join('\n');
}
