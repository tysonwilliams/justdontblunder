/**
 * Owner review: replace the contact placeholder and confirm this copy
 * before optional accounts launch. Do not add a certification claim.
 */

export const PRIVACY_EFFECTIVE_DATE = 'November 14, 2026';

export const OWNER_CONTACT_LABEL = 'Owner contact email';

export const OWNER_CONTACT_NOTE = 'Placeholder. The owner still needs to add this before accounts launch.';

export const OWNER_CONTACT_PLACEHOLDER = "[add the owner's contact email here]";

export const DELETE_DATA_HREF = '/delete-account';

export type PrivacyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'link'; href: string; label: string };

export type PrivacySection = {
  heading: string;
  blocks: readonly PrivacyBlock[];
};

export const privacyIntro =
  'Just Don\'t Blunder is a chess trainer. You can play without an account. This page says what stays on your device, what an optional account will sync when that ships, and what we do not do.';

export const privacySections: readonly PrivacySection[] = [
  {
    heading: 'Playing as a guest',
    blocks: [
      {
        kind: 'paragraph',
        text: 'You can play, learn, and drill with no account and no sign-in. Progress stays in this browser or on this device. That includes streaks, XP, lessons, drill results, review history, and positions built from a public username or a pasted game.',
      },
      {
        kind: 'paragraph',
        text: 'The scan cursor — which public games this device has already read — stays in that same local storage. The full games are not kept. Appearance and sound settings stay on this device too.',
      },
    ],
  },
  {
    heading: 'Optional accounts, coming soon',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Optional accounts are coming soon. They are not available yet, and play will stay open without one.',
      },
      {
        kind: 'paragraph',
        text: 'When an account is offered, sign-in will be an email magic link or Google sign-in, through Supabase. Supabase is hosted in the United States (region us-west-2). The account is there to sync progress. You can keep playing as a guest if you do not want one.',
      },
    ],
  },
  {
    heading: 'What an account will sync',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Synced data will be limited to:',
      },
      {
        kind: 'list',
        items: [
          'Profile: display name and timezone',
          'Linked Chess.com and Lichess usernames',
          'Scanned game ids, not the full games',
          'Drills',
          'Review history',
          'Attempts',
          'Streak days',
        ],
      },
    ],
  },
  {
    heading: 'Chess.com and Lichess',
    blocks: [
      {
        kind: 'paragraph',
        text: 'If you type a public username, your browser fetches public games directly from Chess.com or Lichess. The app never asks for a chess-site password, and it does not send one. You can also paste a PGN from one game. That is read on this device and turned into positions.',
      },
    ],
  },
  {
    heading: 'Ads and selling data',
    blocks: [
      {
        kind: 'paragraph',
        text: 'There are no ads. We do not sell your data.',
      },
    ],
  },
  {
    heading: 'Hosting',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The website is hosted on Vercel.',
      },
    ],
  },
  {
    heading: 'Deleting data',
    blocks: [
      {
        kind: 'paragraph',
        text: 'You can erase the progress and the scan cursor stored on this device. When accounts exist, a signed-in player will be able to delete the account and all synced data from that same page.',
      },
      { kind: 'link', href: DELETE_DATA_HREF, label: 'Delete data' },
    ],
  },
];

export function privacyPolicyText(): string {
  const parts: string[] = [
    `Effective ${PRIVACY_EFFECTIVE_DATE}.`,
    privacyIntro,
    OWNER_CONTACT_LABEL,
    OWNER_CONTACT_NOTE,
    OWNER_CONTACT_PLACEHOLDER,
  ];
  for (const section of privacySections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'paragraph':
          parts.push(block.text);
          break;
        case 'list':
          parts.push(...block.items);
          break;
        case 'link':
          parts.push(block.label);
          break;
        default: {
          const _exhaustive: never = block;
          return _exhaustive;
        }
      }
    }
  }
  return parts.join('\n');
}
