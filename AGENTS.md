This is an Expo / React Native app. The shipping target in this repo is web, on a phone and on a desktop. Prioritize mobile-first layout, performance, and cross-platform compatibility.

## Product rules

Keep these on every change:

- A blunder is mate in 1 or a net material loss. Equal trades are fine. Mate in 2 or deeper is not, by itself, a blunder.
- Drills pass any safe move. Red marks a blunder. Green marks a save.
- Every position must be reachable in a real game.
- Phone: one screen, no scroll. The board is full width and stays fixed after a move (120px header, 88px feedback tray).
- Desktop: a large board filling most of the screen.
- Legal-move dots show on click and throughout a press-and-hold drag.
- Play opens after about 3 personal blunders while a username scan continues in the background.
- Drill modes are Play (the default), Pick, and Review. Streak is a sudden-death toggle on Play only.
- Never block play behind sign-in. Guest-first always. Progress is local (Zustand + AsyncStorage).
- Public Chess.com / Lichess username import never asks for a chess-site password. Pasted PGN is the other import path.
- Keep the core loop: concrete threat language, the opponent's capture on the board, a short explanation, Try again, and Review.

Out of scope until a task adds them: accounts, Supabase, and store builds. `ios/` and `android/` are not checked in. There is no `eas.json`. Do not claim those exist.

The running app does not load a chess engine. Do not add Stockfish (or any engine) back into the web or native bundle. `scripts/refresh-acceptable.mts` is the only Stockfish caller. It uses the `stockfish` devDependency to rebuild the offline teaching window in `src/data/beginner-blunders.json`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

This repo uses npm (`package-lock.json`). There is no Bun lockfile.

```bash
npx expo install <package>       # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npm run web                      # Expo web on http://localhost:43127
npm run start                    # Expo dev server
npm run lint                     # ESLint via expo lint (app/ and src/)
npm test                         # unit tests (vitest)
npm run typecheck                # tsc --noEmit
node scripts/board-stability.mjs # phone board stays put after a move; needs npm run web
npx expo-doctor                  # diagnose dependency and config issues
npx expo install --fix           # fix incompatible package versions
```

Run lint, test, and typecheck before declaring a task done. Run `node scripts/board-stability.mjs` when you change the board or the phone layout.

`npm run lint` uses Expo's ESLint config. `react/no-unescaped-entities` is off because this app renders React Native text, not HTML. The React compiler rules `react-hooks/refs`, `react-hooks/immutability`, and `react-hooks/set-state-in-effect` are off because they fail on the current board, drill, and store code. Do not turn them on by rewriting those files unless that is the task.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/`. `app/_layout.tsx` is the root stack. `app/(tabs)/` holds Home (`index`), Learn, Drills, Practice, and Progress. `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) in `src/`, not in `app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Native projects

`ios/` and `android/` are generated (Continuous Native Generation) and are not in this repo. Never create or edit them by hand. Configure native behavior in `app.json` and config plugins.

Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios` or `npx expo run:android` locally, or an EAS development build. EAS is not set up here. Do not add an EAS config unless a task asks for a native build.

Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
