# Just Don't Blunder

A Chessreps-style trainer for new and intermediate players. Build the pre-move habit — **Checks / Captures / Threats / Hanging?** — and catch beginner blunders with friendly feedback.

## Features (v0.1)

- Interactive board (tap + drag, legal moves only)
- Instant blunder feedback with square highlights
- Pre-move habit checklist
- Daily drill sessions from full-board positions with immediate danger (hanging pieces, live forks, absolute pins, mate-in-1)
- Local streaks and progress (no account)

## Run locally

```bash
npm install
npm run web          # Expo web on http://localhost:43127
# or
npx expo start       # then press `w` for web / scan for device
```

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run web` | Start Expo web on port **43127** |
| `npm run start` | Expo dev server |
| `npm test` | Unit tests (patterns, blunder thresholds, fixtures) |
| `npm run typecheck` | TypeScript check |

## Stack

- Expo SDK 58 + Expo Router (tabs)
- TypeScript, chess.js, Zustand + AsyncStorage
- Stockfish.js lite (single-thread WASM) on **web** for engine eval
- Pattern detectors for instant hanging-piece / fork / back-rank hints

Native iOS/Android use the same UI; Stockfish falls back to a stub until a native engine module is wired. Pattern feedback still works offline everywhere.

## Project layout

```
app/(tabs)/          Home, Learn, Drills, Practice, Progress
src/components/      Board, habit checklist, streak badge
src/engine/          Stockfish wrapper, eval merge, patterns
src/logic/           chess.js helpers, drills
src/data/            beginner-blunders.json
src/store/           local progress
src/theme/           dark high-contrast tokens
public/              Stockfish WASM assets for web
```

## Out of scope (for now)

Accounts, Lichess/Chess.com sync, multiplayer, openings, PGN import, payments.
