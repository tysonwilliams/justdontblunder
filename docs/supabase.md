# Supabase

Play never waits on an account. Guest progress stays in AsyncStorage (`jdb-progress-v1`, version 2). When a publishable client exists and someone is signed in, that local document syncs. Guests do not call the progress sync.

`EXPO_PUBLIC_SYNC_ENABLED=false` is the kill switch. Leave it unset, or set it to `true`, and sync runs for a signed-in session. Any other value except the exact string `false` also allows sync.

The hosted project `nhnozbrwyiiynargawmc` already has `supabase/migrations/20261114220421_init_data_layer.sql`, `supabase/migrations/20261115024156_fix_handle_new_user_coalesce.sql`, and the puzzle seed. Do not run `supabase db push` or `supabase config push`. `config push` would overwrite the hosted site URL and redirect list. The fix migration is already applied: `pg_catalog.coalesce` is not a function, and that call made every sign-up return 500.

Never put the service role key, the Google client secret, or the Apple secret in the app, in git, or in a `EXPO_PUBLIC_*` variable. The client refuses a JWT whose `role` is `service_role`.

## Vercel

The URL and the anon key are already set. Expo inlines `EXPO_PUBLIC_*` at build time, so a later env change needs a new deploy.

| Name | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://nhnozbrwyiiynargawmc.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the publishable (anon) key, the legacy anon JWT |
| `EXPO_PUBLIC_SYNC_ENABLED` | leave unset. Set the string `false` only to turn sync off |
| `EXPO_PUBLIC_OAUTH_PROVIDERS` | leave unset. Google and Apple buttons stay hidden. After those providers are enabled, set `google`, `apple`, or `google,apple`, then redeploy |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | public web client id `129452132407-vqeapd2vu4md3qn81t439kpdbocksghq.apps.googleusercontent.com`. Set this in Vercel so Google's consent screen shows this site. Leave it unset to keep the Supabase redirect |
| `EXPO_PUBLIC_ERROR_REPORTING` | leave unset. Crash reports stay off. Set the string `true` only after `supabase/migrations/20261126233000_client_errors.sql` is applied, then redeploy. Any other value, including unset, sends nothing |

Redeploy after an app change so the sign-in screens ship. No new env var is required for sync. OAuth buttons need `EXPO_PUBLIC_OAUTH_PROVIDERS`, and only after Google or Apple is enabled below. Google on the web also needs `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. Without that client id, Google keeps the Supabase redirect.

## Sign-in

All of these are optional. The drills, the home trainer, and the phone board do not ask for an account.

| Method | Call | Where it returns |
| --- | --- | --- |
| Email magic link | `signInWithOtp` | `/auth/callback` |
| Email and password sign-up | `signUp`, with a confirmation email | `/auth/callback` |
| Email and password sign-in | `signInWithPassword` | stays in the app |
| Forgot password | `resetPasswordForEmail`, then `updateUser({ password })` | `/auth/update-password` |
| Google on the web, with `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google Identity Services, then `signInWithIdToken({ provider: 'google', token, nonce })` | stays in the app, then Progress |
| Google without that client id, and Google on iOS or Android | `signInWithOAuth({ provider: 'google' })` | `/auth/callback` |
| Apple on the web | `signInWithOAuth({ provider: 'apple' })` | `/auth/callback` |

Chess.com and Lichess stay a public username. The app never asks for a chess-site password. Lichess OAuth is not part of this.

Apple on the web, and Google when it still uses the redirect, go through the main client. It is PKCE (`flowType: 'pkce'`) and does not detect the session in the URL. `/auth/callback` exchanges that `code`. The code verifier stays in AsyncStorage on the browser that started the redirect, which is the same browser the provider sends back to.

Google on the web uses Google Identity Services (`https://accounts.google.com/gsi/client`) when `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set. The script loads only in the browser, and only when the Google button is on screen. Google's button returns an ID token on this origin. `signInWithIdToken` runs here, so the consent screen shows justdontblunder.com instead of `nhnozbrwyiiynargawmc.supabase.co`. The root session listener merges guest progress on that sign-in, the same way it does after `/auth/callback`. The account screen then opens Progress, which is where that callback sends a finished Google redirect. iOS and Android do not load the script. They keep `signInWithOAuth`. If the client id is missing, or the script does not load, the web button uses that redirect too.

Email links use a second client with `flowType: 'implicit'`. Magic link (`signInWithOtp`), signup confirmation (`signUp`), password recovery (`resetPasswordForEmail`), and `resend` go through it. That client does not persist a session and uses the storage key `jdb-implicit-email`, so it does not store a code verifier and does not warn about a second GoTrue client on the PKCE storage key. Supabase then redirects with the session in the URL hash (`#access_token` and `#refresh_token`). `/auth/callback` and `/auth/update-password` read that hash, including `error` and `error_description`, call `setSession` on the main client, and clear the hash. A `code` or a `token_hash` on those pages still works. A recovery link opens `/auth/update-password`.

The hash can be read in any browser. Mail on an iPhone can open Safari, and a home-screen web app can open a link that was requested somewhere else. When email confirmation is off, `signUp` may return a session immediately. That session is copied onto the main client with `setSession`.

If a PKCE `code` exchange still fails and the link's `type` is `signup` or `email`, the callback says "Your email is confirmed. Sign in on this device to continue." and shows the account button. Any other failed code keeps the expired-link message.

Google and Apple buttons stay hidden until `EXPO_PUBLIC_OAUTH_PROVIDERS` lists them. The value is a comma-separated list of `google` and `apple`. Blank, unknown names, and an unset variable show no button. Expo inlines `EXPO_PUBLIC_*` at build time, so a Vercel change needs a new deploy. With the list unset, sign-in, create-account, and password reset stay on the email magic link and email plus password. Those screens do not show an OAuth button or the "aren't turned on yet" line.

When the list includes a provider, that button still reads `GET /auth/v1/settings` with the anon key. A provider marked off is hidden. If that request fails, the listed button stays, and a provider that is not enabled shows "isn't turned on yet" instead of a broken redirect. `signInWithOAuth`, the Google id-token path, and the native Apple identity-token path stay in the app either way.

To show the buttons again:

1. Enable the provider in Supabase. The provider redirect is `https://nhnozbrwyiiynargawmc.supabase.co/auth/v1/callback`. The Google and Apple sections below are the rest of that setup.
2. In Vercel, set `EXPO_PUBLIC_OAUTH_PROVIDERS` to the providers you enabled. Use `google,apple` for both. For Google on the web, also set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` to the web client id in the Google section.
3. Redeploy so the web build picks up the variables.

Apple on a future iOS build can pass the identity token from AuthenticationServices into `startOAuthSignIn` with `transport: 'native-id-token'`, which calls `signInWithIdToken({ provider: 'apple' })`. The web button does not use that path. There is no native Apple button in this repo, and `expo-apple-authentication` is not installed.

On the first sign-in, local progress (training, review, library, preferences, scan) is merged with the account and both sides are kept. The merged copy is saved on the device, so play still works offline. Later edits sync while a session exists and a username scan is quiet. Signing out leaves the device copy in place. Deleting the account calls `delete_my_account`, signs out, and erases the device copy.

## What you set in the dashboards

Do these by hand. Do not `supabase config push`.

### URL configuration

Supabase → Authentication → URL Configuration.

- Site URL: `https://justdontblunder.com` with no trailing slash.
- Add each redirect URL as its own row. The site URL does not allow these paths on its own.
  - `https://justdontblunder.com/auth/callback`
  - `https://justdontblunder.com/auth/update-password`
  - `http://localhost:43127/auth/callback`
  - `http://localhost:43127/auth/update-password`

### Email

Supabase → Authentication → Providers → Email: enabled.

Turn on Confirm email so a password sign-up waits for the link. Magic links send mail either way. If confirmations are off, sign-up returns a session and the app signs the player in.

The built-in mailer is rate-limited. For real use, add custom SMTP under Authentication → Emails. The SMTP password stays in Supabase. The free tier has no custom SMTP, so these templates cannot be changed. Leave the defaults. The implicit email client makes those default links work across browsers.

The templates below are optional once custom SMTP is available. They put a `token_hash` on `/auth/callback`, and this app still verifies that.

Confirm signup:

```html
<h2>Confirm your email</h2>
<p>Follow the link to finish creating your Just Don't Blunder account.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm email</a></p>
```

Magic link:

```html
<h2>Sign in to Just Don't Blunder</h2>
<p>Follow the link to sign in. It expires soon and works once.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Sign in</a></p>
```

Reset password:

```html
<h2>Reset your password</h2>
<p>Follow the link to choose a new password.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password">Choose a new password</a></p>
```

### Google

Web sign-in uses Google's button when `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set. The page origin is this site, so the consent screen shows justdontblunder.com. The ID token is sent to `signInWithIdToken({ provider: 'google', token, nonce })` on the main client.

Generate a new random nonce for each sign-in. Pass its SHA-256 hex to Google Identity Services, and pass the raw nonce to `signInWithIdToken`. Supabase hashes that raw nonce the same way and compares it with the token. Leave Skip nonce check off.

In the Google Auth Platform, use a Web application client.

1. Authorized JavaScript origins. GIS checks these. They are the origins Google is allowed to show:
   - `https://justdontblunder.com`
   - `http://localhost:43127` for dev
2. Authorized redirect URI. The fallback `signInWithOAuth` path, and Supabase's Google provider, still use this. It is Supabase, not the app:
   - `https://nhnozbrwyiiynargawmc.supabase.co/auth/v1/callback`
3. Data Access scopes: `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`.
4. Copy the Client ID and Client secret.

Supabase → Authentication → Providers → Google:

- Enable Google.
- Paste the Client ID and Client secret. The Client ID is the same value as `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
- Leave Skip nonce check off.
- Save.

The secret stays in that form. Do not put it in the app, in git, or in Vercel.

In Vercel, set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` to:

`129452132407-vqeapd2vu4md3qn81t439kpdbocksghq.apps.googleusercontent.com`

This is a public web client id, not a secret. Redeploy after setting it. The button stays hidden until `EXPO_PUBLIC_OAUTH_PROVIDERS` includes `google`. If `google` is listed but this provider is still off, the button hides or says Google sign-in isn't turned on yet.

If `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is unset, the web button keeps `signInWithOAuth({ provider: 'google' })` and returns through `/auth/callback`. iOS and Android always use that redirect. They do not load the GIS script.

### Apple

This is the web OAuth flow. It needs an Apple Developer account. The web secret expires every 6 months. Put a calendar reminder on that rotation. If you lose the `.p8`, revoke the key and create another. `*.p8` is gitignored.

1. Copy the 10-character Team ID from the Apple Developer account.
2. Identifiers → App IDs → add an explicit App ID, for example `com.justdontblunder.app`. Enable Sign in with Apple. Leave the server-to-server notification URL blank. Supabase does not use it.
3. Identifiers → Services IDs → add one, for example `com.justdontblunder.web`. Enable Sign in with Apple and configure the website:
   - Primary App ID: the App ID from the previous step.
   - Domain: `nhnozbrwyiiynargawmc.supabase.co`
   - Return URL: `https://nhnozbrwyiiynargawmc.supabase.co/auth/v1/callback`
4. Keys → add a key named for this app, enable Sign in with Apple, and bind it to that App ID. Download `AuthKey_XXXXXXXXXX.p8` once and store it privately. Note the Key ID.
5. Generate the client secret in Supabase → Authentication → Providers → Apple. The generator needs the Team ID, the Key ID, the Services ID, and the `.p8`. It runs in the browser. Use Firefox or Chrome. Safari is not supported for that tool. The secret lasts 6 months.

Then in that same Apple provider form:

- Enable Apple.
- Client IDs: put the Services ID first (`com.justdontblunder.web` if you used that example). Web `signInWithOAuth` uses the first ID. When a native iOS build is added later, add its bundle id after the Services ID. If a native App ID is first, Apple rejects the web flow. Native `signInWithIdToken` accepts any ID in the list.
- Secret: the generated secret, not the `.p8`.
- Save.

The secret and the `.p8` stay out of Vercel and out of the app. The button stays hidden until `EXPO_PUBLIC_OAUTH_PROVIDERS` includes `apple` and you redeploy. If `apple` is listed but this provider is still off, the button hides or says Apple sign-in isn't turned on yet.

### Account deletion

`public.delete_my_account()` is already in the database. The delete page calls it for a signed-in user, then signs out and erases the device copy. No new SQL.

## Local stack

`supabase/config.toml` is for a local Docker stack. `project_id` is the local id, not the hosted ref. It lists `http://localhost:43127/auth/callback` and `http://localhost:43127/auth/update-password` so a local stack can redirect. Do not `supabase config push`.

A local `npx supabase db reset` applies the migrations and `supabase/seeds/puzzles.sql`.

`scripts/seed-puzzles.mts` rewrites that seed from `src/data/beginner-blunders.json` (160 positions, source `beginner-blunders`, license `All rights reserved`). The hosted database already has the seed. Re-run it only if the starter bank changes, as the database owner. The anon key cannot write `puzzles`.

```bash
npm run seed:puzzles
npx supabase db query -f supabase/seeds/puzzles.sql --linked
```

Re-running the file updates the teaching columns and does not reset `created_at`.

## What is stored

| Table | Who can read | Who can write |
| --- | --- | --- |
| `profiles` | the signed-in user, `id = auth.uid()` | that user. A trigger on `auth.users` inserts the row. |
| `linked_accounts` | that user | that user. Chess.com `verified` stays false (check and trigger). |
| `scanned_games` | that user | that user. Game ids only. No PGN column. |
| `puzzles` | anon and authenticated | nobody from the client. The owner seeds it. |
| `positions` | authenticated | authenticated insert only. `fen_key` dedupes. No client update or delete. |
| `user_drills` | that user | that user. One of `puzzle_id` or `position_id`. |
| `review_entries` | that user | that user. |
| `attempts` | that user | insert only. No update or delete policy. |
| `daily_streaks` | that user | that user. `local_date` is the device calendar date for `profiles.timezone`. |
| `client_errors` | nobody from the client | anon and authenticated can insert one row. No select, update, or delete. The row is message, stack, route, app version, and platform. No account id, email, or IP column. Apply `20261126233000_client_errors.sql` by hand. Do not `db push`. |

RLS is enabled on every table. User-owned policies use `(select auth.uid())`. RLS is not forced: the table owner still bypasses it, which the signup trigger and the delete cascade need when `postgres` is not a superuser. API roles do not own the tables.

`private` is not in the exposed API schemas. Security-definer functions live there with `search_path = ''`. `private.handle_new_user` inserts the profile and copies a display name with plain `coalesce`. `public.delete_my_account()` is the RPC a signed-in user calls to delete their `auth.users` row. Everything owned by that id cascades. Sessions are deleted before the user row. The app does not use `user_metadata` for authorization.

Username scans still run in the browser. Sync uploads the cursor and the public game ids. Fallback ids that embed PGN text stay in AsyncStorage and are not uploaded.

## Sync

`src/data/sync` maps the `jdb-progress-v1` version-2 slices (`training`, `review`, `library`, `preferences`, `scan`) onto these tables. Extra columns on `profiles`, `user_drills`, and `review_entries` hold the counters, lesson ids, pool order, and review schedule that the local document already stores.

A review card is due now, or after 1, 3, 7, 16, or 35 days. A miss is due again the same day. `review_entries.interval_days` stores `0` for that short box, and `100 * consecutive saves + interval` after a save, so a 1-day card is not confused with the old two-save mirror. `supabase/migrations/20261126180000_review_spaced_repetition.sql` marks rows still on that mirror as due now. Apply it with the other migrations. Do not run `supabase db push` or `supabase config push`.

With a client and a session, sign-in pulls, merges, saves the merge locally, then pushes. Local rows win when the two sides disagree, except a shared review card, which keeps the earlier due date and, on a tie, the shorter interval. Lists and counters are unions and maximums, so a guest drill, review, attempt, lesson, or seen game is not dropped. A blank guest document does not wipe an account. The puzzle pool cap keeps guest drills first. Push is skipped while a scan is running on this device.
