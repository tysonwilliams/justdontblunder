import { sectionText, type LegalSection } from '@/src/legal/blocks';
import { SITE_HOST, SUPPORT_EMAIL } from '@/src/legal/contact';

export const PRIVACY_EFFECTIVE_DATE = 'November 26, 2026';

export const DELETE_DATA_HREF = '/delete-account';

export const TERMS_HREF = '/terms';

export const privacyIntro =
  'Just Don\'t Blunder is a chess trainer at justdontblunder.com. You can play, learn, and drill with no account. This page says what we collect, why, who handles it, and how to delete it.';

export const privacySections: readonly LegalSection[] = [
  {
    heading: 'Who we are',
    blocks: [
      {
        kind: 'paragraph',
        text: `Just Don't Blunder runs ${SITE_HOST}. Email us with a question about this policy or your data.`,
      },
      { kind: 'mail', email: SUPPORT_EMAIL, testID: 'support-email' },
      {
        kind: 'paragraph',
        text: 'We do not collect a payment card or a date of birth. We never ask for a Chess.com or Lichess password.',
      },
    ],
  },
  {
    heading: 'Playing with no account',
    blocks: [
      {
        kind: 'paragraph',
        text: 'You can use the whole trainer with no account. We do not ask for your name, your email, or a password to do that.',
      },
      {
        kind: 'paragraph',
        text: 'Progress stays on this device, in this browser. It includes your streak, your best Streak run, XP, finished lessons, drill counts, the review pile, positions built from a public username or a pasted game, the Chess.com or Lichess username you typed, and the scan cursor.',
      },
      {
        kind: 'paragraph',
        text: 'The scan cursor remembers which public games this device has already read: the site, the username, the game ids, the Chess.com months already fetched, and how far a Lichess page got. The full games are not kept. A pasted game is read on this device and turned into positions.',
      },
      {
        kind: 'paragraph',
        text: 'Appearance, sound, haptics, and whether you dismissed the optional account prompt stay on this device too. The storage keys are listed under Cookies and local storage.',
      },
      {
        kind: 'paragraph',
        text: 'This copy stays on the device. It is sent to our database only after you sign in, and only when sync is on.',
      },
    ],
  },
  {
    heading: 'Optional account',
    blocks: [
      {
        kind: 'paragraph',
        text: 'An account is optional. Play stays open with no account. Sign-in is provided by Supabase Auth, hosted in the United States (region us-west-2).',
      },
      {
        kind: 'paragraph',
        text: 'Email magic link. You type an email address and we send a one-time sign-in link to it. That address is the account. A magic link can create the account.',
      },
      {
        kind: 'paragraph',
        text: 'Email and password. You choose a password for Just Don\'t Blunder. Supabase Auth stores the email address and the password. The password is not written into your drills or into the progress on this device. Creating the account can send a confirmation email before you are signed in. Forgot password sends a link to choose a new one.',
      },
      {
        kind: 'paragraph',
        text: 'The account page shows the email on the session. When the session has no email, it shows the name from the sign-in provider.',
      },
      {
        kind: 'paragraph',
        text: 'Signing out leaves the copy on this device. Deleting the account removes the account and erases that copy. Google and Apple are described below. Their buttons show only when this build turns that provider on.',
      },
    ],
  },
  {
    heading: 'Google sign-in',
    blocks: [
      {
        kind: 'paragraph',
        text: 'When you continue with Google, we request only the openid, email, and profile scopes. No other Google API is requested.',
      },
      {
        kind: 'paragraph',
        text: 'From those scopes, Supabase Auth receives your email address, your name when Google provides one, your Google account ID, and the profile picture URL when the profile scope includes one.',
      },
      {
        kind: 'paragraph',
        text: 'The app uses the email, or the name when the email is missing, as the label on the account page. It does not show the profile picture. It does not copy the picture, the Google account ID, or the name into your drills. Supabase Auth keeps them with the sign-in so the same Google account can sign in again. Your training rows use a separate account id that Supabase assigns.',
      },
      { kind: 'subheading', text: 'Limited Use' },
      {
        kind: 'paragraph',
        text: 'Just Don\'t Blunder\'s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
      },
      {
        kind: 'paragraph',
        text: 'We use Google user data only to sign you in and to label the account. We do not sell it. We do not use it for advertising. We do not use it to decide credit. People do not read it unless you ask us to, we need it to investigate abuse or keep the service secure, or the law requires it.',
      },
      {
        kind: 'paragraph',
        text: 'Supabase Auth stores the Google sign-in. We do not give Google user data to an advertising network. Resend delivers mail only when Supabase Auth sends one: a magic link, a confirmation, or a password reset. Resend then sees the recipient address and that message. It does not receive your Google account ID, your name, or your profile picture.',
      },
    ],
  },
  {
    heading: 'Apple sign-in',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Apple sign-in is in the app. The button shows when this build turns Apple on. It also goes through Supabase Auth.',
      },
      {
        kind: 'paragraph',
        text: 'Apple returns the email address you approve, which can be a private relay address, and it can return your name. The app labels the account with the email, or with the name when the email is missing.',
      },
      {
        kind: 'paragraph',
        text: 'The code also has a native Apple path. It is not the button on this website. If a build uses it, the name Apple returns is saved on the sign-in record: the full name, the given name, and the family name.',
      },
    ],
  },
  {
    heading: 'Chess.com and Lichess',
    blocks: [
      {
        kind: 'paragraph',
        text: 'If you type a public Chess.com or Lichess username, your browser fetches public games from that site. The request identifies Just Don\'t Blunder and says the fetch is public games only. We never ask for a password on Chess.com or Lichess, and we never send one. There is no Lichess sign-in.',
      },
      {
        kind: 'paragraph',
        text: 'The scan reads public blitz, rapid, and classical games, plus Chess.com daily games. Bullet is skipped. It looks for blunders and keeps positions. It stops around 100 positions or about 250 games. The full games are not stored.',
      },
      {
        kind: 'paragraph',
        text: 'A public game id can be saved with the account. An id that would contain a scrap of the game text stays on this device and is not uploaded. You can paste one game. That text is read on this device and turned into positions. The full paste is not stored on the account. A Chess.com username is never marked verified.',
      },
    ],
  },
  {
    heading: 'What an account syncs',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Sync runs when you are signed in and the build has a Supabase client. It stays off when the build sets sync to false. A guest does not sync. The first sign-in merges this device with the account and keeps both sides. Later edits sync while you are signed in and a username scan on this device is quiet. The merged copy stays on the device, so play still works offline.',
      },
      {
        kind: 'paragraph',
        text: 'Synced data is your training record. We do not upload the full games.',
      },
      { kind: 'subheading', text: 'Profiles' },
      {
        kind: 'paragraph',
        text: 'One row per account, in the profiles table:',
      },
      {
        kind: 'list',
        items: [
          'The account id Supabase assigns, when the row was created, and when it was last updated. This id is not your Google account ID.',
          'A display name, only when the sign-in record already had one. The app does not ask you to type a display name. The name from Google or Apple stays on the sign-in record.',
          'The timezone of the device that last saved, so dates use your calendar.',
          'Whether you said you are brand new or you know the basics, if you chose.',
          'Whether you skipped the welcome, and whether you skipped the drills prompt.',
          'The missed-review date, the streak count, and the last drill date.',
          'Drills completed, drills correct, blunders avoided, blunders made, and practice moves.',
          'Theme results for hanging, fork, pin, back rank, and missed mate: how many you tried, and how many were correct.',
          'Your record streak, best puzzle streak, and XP.',
          'The lesson ids you finished.',
          'Scan status: the phase, how many positions were found, how many games were read, and a short status message.',
        ],
      },
      { kind: 'subheading', text: 'Linked accounts' },
      {
        kind: 'paragraph',
        text: 'The linked_accounts table stores a public Chess.com or Lichess username for the account:',
      },
      {
        kind: 'list',
        items: [
          'The site and the username.',
          'Verified, which stays false for Chess.com.',
          'When that username was last scanned.',
          'The scan cursor: site, username, newest game time, Chess.com months already read, the Lichess page marker, whether older games are finished, and how many games were read. Seen game ids are stored with scanned games, not inside this cursor.',
          'When the row was created and last updated.',
        ],
      },
      { kind: 'subheading', text: 'Scanned games' },
      {
        kind: 'paragraph',
        text: 'The scanned_games table stores the site and the public game id, and the time that id was saved. It does not store the moves or the PGN.',
      },
      { kind: 'subheading', text: 'Drills' },
      {
        kind: 'paragraph',
        text: 'The user_drills table is your library:',
      },
      {
        kind: 'list',
        items: [
          'A starter puzzle or a saved position, and a local id.',
          'The public source game id and the move, when the scan recorded a real id.',
          'Whether the position came from a pasted game, and its order in the library.',
          'When the row was created.',
        ],
      },
      { kind: 'subheading', text: 'Positions' },
      {
        kind: 'paragraph',
        text: 'The positions table stores a chess position taken from a personal game, once per board:',
      },
      {
        kind: 'list',
        items: [
          'The board, whose move it is, the theme, and the square at risk.',
          'The prompt, the solution, other accepted moves, the trap line, a short note, and the expected material drop.',
          'When the row was created.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'A position row has no account id. Any signed-in player can read it. It does not include your email, your name, or your username.',
      },
      { kind: 'subheading', text: 'Reviews' },
      {
        kind: 'paragraph',
        text: 'The review_entries table is your review pile:',
      },
      {
        kind: 'list',
        items: [
          'The puzzle or position, and whether you have saved it once.',
          'A due date, the interval in days, and its place in the pile.',
          'A list for miss notes. Play does not fill that list.',
          'When the row was created and last updated.',
        ],
      },
      { kind: 'subheading', text: 'Attempts' },
      {
        kind: 'paragraph',
        text: 'The attempts table can store a move, whether it was safe or a blunder, and the time. The app you play does not add a row for each move. The counts live on the profile. A row that is already there stays until you delete the account. The app cannot edit or delete a single attempt.',
      },
      { kind: 'subheading', text: 'Streak days' },
      {
        kind: 'paragraph',
        text: 'The daily_streaks table stores calendar dates you trained, using the timezone on your profile. The app sends the date of your latest drill and keeps dates already saved on the account.',
      },
      { kind: 'subheading', text: 'Leaderboard' },
      {
        kind: 'paragraph',
        text: 'Streak can post a score to a public weekly board and an all-time board. The week resets Monday at 00:00 UTC. This is off until you turn it on. You choose a public display name in the app. The board shows that name and the score. It does not show your email. Guests are not on the board. Your best Streak run stays on this device either way.',
      },
      {
        kind: 'paragraph',
        text: 'The leaderboard_names table stores the public display name and whether you opted in. The streak_scores table stores the score, the week, and the time. Both belong to the account. Deleting the account removes the leaderboard name and scores.',
      },
      { kind: 'subheading', text: 'Starter puzzles' },
      {
        kind: 'paragraph',
        text: 'The puzzles table is the shared lesson bank. Guests and signed-in players can read it. The app does not write it. Those rows are lessons, not your account.',
      },
    ],
  },
  {
    heading: 'Who handles the data',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Supabase, in the United States (region us-west-2), stores the account and the tables above, and runs sign-in.',
      },
      {
        kind: 'paragraph',
        text: `Vercel hosts ${SITE_HOST} and serves the website.`,
      },
      {
        kind: 'paragraph',
        text: `Resend, in the United States (region us-east-1), sends the transactional email Supabase Auth asks for: magic links, signup confirmation, and password resets. The message goes to the address you entered. Open tracking and click tracking are off for ${SITE_HOST}. We do not send marketing mail.`,
      },
      {
        kind: 'paragraph',
        text: 'The app does not include an analytics product. There are no ads. We do not sell your data.',
      },
      {
        kind: 'paragraph',
        text: 'Vercel and Supabase receive the technical details of a request, including the IP address and the time, because that is how the page and the sign-in are delivered. Those details are not copied into your drills, and they are not used for ads.',
      },
    ],
  },
  {
    heading: 'Cookies and local storage',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The app does not set an advertising cookie or an analytics cookie. It does not use a cookie to follow you across other sites.',
      },
      {
        kind: 'paragraph',
        text: 'The data we keep on the device is in local storage:',
      },
      {
        kind: 'list',
        items: [
          'jdb-progress-v1 holds streaks, XP, lessons, drill counts, review, imported positions, the username, and the scan cursor.',
          'jdb-theme-v1 holds light, dark, or match the system.',
          'jdb-feedback-v1 holds sound and haptics.',
          'jdb-account-prompt-v1 holds whether you dismissed the account prompt.',
          'The Supabase session holds the access token and the refresh token while you are signed in.',
          'A short-lived sign-in verifier is stored while Google or Apple sends you back to the site.',
          'jdb-implicit-email lets an email link open in any browser. That entry does not keep a session.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Clearing this site\'s data in the browser removes the local copy. Signing in with Google or Apple happens on that company\'s site, under their policy, and then returns here.',
      },
    ],
  },
  {
    heading: 'How long we keep it',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Progress on this device stays until you erase it, clear the site data, or delete the account. Appearance, sound, and the dismissed-prompt flag stay through an erase. They go when you clear the site data.',
      },
      {
        kind: 'paragraph',
        text: 'The account and the rows that belong to it stay until you delete the account. A public display name and its scores stay until then. Turning the board off hides the name. It does not delete the scores. The app has no separate expiry timer.',
      },
      {
        kind: 'paragraph',
        text: 'A shared chess position has no account id, so it remains after the account is deleted. It is the board and the lesson text, without your email, your name, or your username. The starter puzzles are shared lessons.',
      },
      {
        kind: 'paragraph',
        text: 'Mail already sent is not pulled back out of your inbox when you delete the account.',
      },
    ],
  },
  {
    heading: 'Deleting data',
    blocks: [
      {
        kind: 'paragraph',
        text: 'You can erase this device, and a signed-in player can delete the account, from the delete page.',
      },
      { kind: 'link', href: DELETE_DATA_HREF, label: 'Delete data', testID: 'privacy-delete-link' },
      {
        kind: 'paragraph',
        text: 'Erasing this device removes streaks, XP, lessons, drill results, review history, imported positions, the Chess.com or Lichess username, and the scan cursor stored here. If you are signed in, it also signs you out. The synced copy stays until you delete the account, including a public leaderboard name and its scores. Appearance and sound stay.',
      },
      {
        kind: 'paragraph',
        text: 'Deleting the account calls delete_my_account. That removes the sign-in sessions, then the account. The profile, linked usernames, scanned game ids, drills, reviews, attempt rows, streak days, and the leaderboard name and scores go with it. The app then signs out and erases the progress on this device. You can keep playing as a guest. This cannot be undone.',
      },
      {
        kind: 'paragraph',
        text: 'Shared positions already stored without your account id are not removed by that delete.',
      },
    ],
  },
  {
    heading: 'Children',
    blocks: [
      {
        kind: 'paragraph',
        text: `Just Don't Blunder is a general chess trainer. We do not ask your age. We do not knowingly collect personal information from a child under 13. If you believe a child has given us an email address or an account, email ${SUPPORT_EMAIL} and we will delete the account.`,
      },
    ],
  },
  {
    heading: 'Your rights',
    blocks: [
      {
        kind: 'paragraph',
        text: `Email ${SUPPORT_EMAIL} to ask for a copy of the personal data the account holds, to correct it, or to delete it. Write from the account email if you can, so we know the request is yours.`,
      },
      {
        kind: 'paragraph',
        text: 'You can delete the account and the device copy yourself on the delete page. You can choose a new password from the account page. The app has no screen for changing the email address on an account. Email us for that.',
      },
    ],
  },
  {
    heading: 'Security',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The site is served over HTTPS. Supabase Auth holds the password for an email account. Your training rows are locked to your sign-in: you can read your own profile, usernames, game ids, drills, reviews, attempts, and streak days. The public Streak board shows a display name and a score, and only when that player turned it on. Starter puzzles can be read with no account. Shared positions can be read by any signed-in player and are not labeled with an account. The app refuses a service-role key, so the browser cannot administer the database.',
      },
    ],
  },
  {
    heading: 'Changes',
    blocks: [
      {
        kind: 'paragraph',
        text: `When this policy changes, we update this page and the effective date at the top. This version is effective ${PRIVACY_EFFECTIVE_DATE}.`,
      },
      { kind: 'link', href: TERMS_HREF, label: 'Terms', testID: 'privacy-terms-link' },
    ],
  },
  {
    heading: 'Contact',
    blocks: [
      {
        kind: 'paragraph',
        text: `Email ${SUPPORT_EMAIL}.`,
      },
    ],
  },
];

export function privacyPolicyText(): string {
  return [`Effective ${PRIVACY_EFFECTIVE_DATE}.`, privacyIntro, ...sectionText(privacySections)].join('\n');
}
