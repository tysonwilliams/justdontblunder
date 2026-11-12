# Just Don't Blunder

A chess trainer for new and intermediate players. Build the habit of checking before you move. A blunder is mate in 1 or a net material loss. Equal trades are fine.

## Play

- Guest-first. Progress stays on this device. There is no account and no sign-in.
- Home, Learn, Drills, Practice, and Progress.
- Drills pass any safe move. A blunder is red. A save is green.
- Drill modes are Play (the default), Pick, and Review. Streak is a sudden-death toggle on Play only.
- A miss shows the opponent's capture, a short explanation, and Try again. Review plays those misses again.
- Add a public Chess.com or Lichess username, or paste a PGN. The app never asks for a chess-site password. Play opens after about 3 personal blunders while the scan continues.
- Every position is one you could reach in a real game.
- On a phone the board fills the width and stays put after a move: a 120px header, an 88px feedback tray, one screen, and no scroll. On a desktop the board fills most of the screen.
- Legal-move dots show on click and for the whole press-and-hold drag.

## Run locally

```bash
npm install
npm run web
```

Expo web serves at http://localhost:43127. `npm run start` opens the Expo dev server.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run web` | Expo web on port 43127 |
| `npm run start` | Expo dev server |
| `npm run lint` | ESLint (`expo lint` on `app/` and `src/`) |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `node scripts/board-stability.mjs` | Checks that the phone board stays put after a move. Needs the web app running. |

`scripts/refresh-acceptable.mts` rebuilds the offline teaching window with the Stockfish CLI. That CLI is the `stockfish` devDependency. The running app does not load Stockfish.

## Stack

- Expo SDK 58 and Expo Router. Screens live in `app/`.
- TypeScript, chess.js, Zustand, and AsyncStorage.
- Blunders are judged in the app with chess.js. No chess engine is bundled into the web or native build.
- Web export is configured for Vercel (`expo export -p web`).

`ios/` and `android/` are not in this repo. Expo generates them for a native build. There is no EAS config and no store build here. There is no Supabase and no account system.

## Project layout

```
app/                 Expo Router screens (Home, Learn, Drills, Practice, Progress)
src/components/      Board, drills, lessons, practice
src/engine/          Pattern detectors (hanging pieces, forks, pins)
src/logic/           chess.js judging, drills, import
src/data/            beginner-blunders.json
src/store/           local progress
src/theme/           color and type tokens
public/              web shell (index.html)
.github/workflows/   lint, test, and typecheck on pull requests and on main
```
