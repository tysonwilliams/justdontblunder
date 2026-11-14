/**
 * Grow the guest drill bank by playing legal moves from the starting position.
 *
 * A position is kept only when it is a legal game (so it is reachable), passes
 * the app's plausibility and material checks, matches one drill theme, has a
 * one-move blunder, and has at least one safe move. Nothing here is copied
 * from the Lichess puzzle database.
 *
 * Run: npm run grow-bank
 */
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import fs from 'node:fs';

import { isAbsolutePin, isLiveForkOn } from '../src/logic/danger.ts';
import type { DrillTheme } from '../src/logic/drills.ts';
import { plausibilityIssues } from '../src/logic/plausible.ts';
import {
  listHangingPieces,
  materialIsReachable,
  moveOutcome,
  pieceName,
} from '../src/logic/safety.ts';

type Theme = DrillTheme;

type Drill = {
  id: string;
  fen: string;
  sideToMove: Color;
  theme: Theme;
  atRiskSquare: Square;
  prompt: string;
  solution: string[];
  note: string;
  expectedDropCp: number;
  acceptable: string[];
  traps: { move: string; line: string[]; explanation: string }[];
};

type Profile = 'develop' | 'back_rank' | 'mate';

type Hit = { theme: Theme; square: Square };

const THEMES: readonly Theme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];
const TARGET = 32;
const MIN_PIECES = 24;
const SEED = 0x6a3d_b10d;
const OUT = new URL('../src/data/beginner-blunders.json', import.meta.url);

const VARIETY_CAP: Record<Theme, number> = {
  hanging: 4,
  fork: 4,
  pin: 4,
  back_rank: 20,
  missed_mate: 20,
};

const DROP: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 10000 };

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pieceCount(fen: string): number {
  return fen.split(' ')[0]?.replace(/\d/g, '').replace(/\//g, '').length ?? 0;
}

function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

function prefix(theme: Theme): string {
  switch (theme) {
    case 'hanging':
      return 'bank-hang';
    case 'fork':
      return 'bank-fork';
    case 'pin':
      return 'bank-pin';
    case 'back_rank':
      return 'bank-back';
    case 'missed_mate':
      return 'bank-mate';
    default: {
      const exhaustive: never = theme;
      return exhaustive;
    }
  }
}

function findKing(game: Chess, color: Color): Square | null {
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (piece?.type === 'k' && piece.color === color) {
        return `${'abcdefgh'[file]}${'87654321'[rank]}` as Square;
      }
    }
  }
  return null;
}

function withOpponentTurn(fen: string, side: Color): string | null {
  const parts = fen.split(' ');
  parts[1] = side === 'w' ? 'b' : 'w';
  try {
    return new Chess(parts.join(' ')).fen();
  } catch {
    return null;
  }
}

function worthMateScan(game: Chess, side: Color): boolean {
  const opp: Color = side === 'w' ? 'b' : 'w';
  const back = side === 'w' ? '1' : '8';
  const soft = (side === 'w' ? 'f2' : 'f7') as Square;
  let heavy = false;
  let kingOnBack = false;
  const board = game.board();
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece.color === opp && (piece.type === 'q' || piece.type === 'r')) heavy = true;
    }
  }
  const king = findKing(game, side);
  if (king?.[1] === back) kingOnBack = true;
  if (!heavy) return false;
  return kingOnBack || game.isAttacked(soft, opp);
}

/** Back-rank mate when a rook or queen mates on the defender's back rank. */
function mateKind(game: Chess, side: Color, need: Record<Theme, number>): Theme | null {
  if (need.back_rank <= 0 && need.missed_mate <= 0) return null;
  const fen = withOpponentTurn(game.fen(), side);
  if (!fen) return null;
  const probe = new Chess(fen);
  const back = side === 'w' ? '1' : '8';
  const king = findKing(game, side);
  let backRank = false;
  let other = false;
  for (const move of probe.moves({ verbose: true })) {
    probe.move(move);
    const mate = probe.isCheckmate();
    probe.undo();
    if (!mate) continue;
    const onBackRank = king?.[1] === back && (move.piece === 'r' || move.piece === 'q') && move.to[1] === back;
    if (onBackRank) backRank = true;
    else other = true;
    if (backRank && (other || need.missed_mate <= 0)) break;
  }
  if (backRank && need.back_rank > 0) return 'back_rank';
  if (other && need.missed_mate > 0) return 'missed_mate';
  return null;
}

function findHits(game: Chess, need: Record<Theme, number>, mates: boolean): Hit[] {
  const side = game.turn();
  const opp: Color = side === 'w' ? 'b' : 'w';
  const hits: Hit[] = [];
  if (mates && (need.back_rank > 0 || need.missed_mate > 0) && worthMateScan(game, side)) {
    const kind = mateKind(game, side, need);
    const king = findKing(game, side);
    if (kind && king) hits.push({ theme: kind, square: king });
  }
  let bestPin: { square: Square; value: number } | null = null;
  let bestFork: { square: Square; value: number } | null = null;
  if (need.pin > 0 || need.fork > 0) {
    const board = game.board();
    for (let rank = 0; rank < 8; rank += 1) {
      for (let file = 0; file < 8; file += 1) {
        const piece = board[rank]?.[file];
        if (!piece || piece.color !== side || piece.type === 'k') continue;
        const square = `${'abcdefgh'[file]}${'87654321'[rank]}` as Square;
        const value = DROP[piece.type];
        if (need.pin > 0 && isAbsolutePin(game, square, side) && game.isAttacked(square, opp)) {
          if (!bestPin || value > bestPin.value) bestPin = { square, value };
        }
        if (need.fork > 0 && isLiveForkOn(game, square, side) && game.isAttacked(square, opp)) {
          if (!bestFork || value > bestFork.value) bestFork = { square, value };
        }
      }
    }
  }
  if (bestPin) hits.push({ theme: 'pin', square: bestPin.square });
  if (bestFork) hits.push({ theme: 'fork', square: bestFork.square });
  if (need.hanging > 0) {
    const loose = listHangingPieces(game.fen(), side)[0];
    if (loose && game.isAttacked(loose.square, opp)) hits.push({ theme: 'hanging', square: loose.square });
  }
  return hits;
}

function copyFor(theme: Theme, type: PieceSymbol, square: Square): { prompt: string; note: string; drop: number } {
  const name = pieceName(type);
  switch (theme) {
    case 'hanging':
      return {
        prompt: `Your ${name} on ${square} is hanging. Make it safe.`,
        note: `The ${name} on ${square} can be taken for more than it is worth. Move it, defend it, or take the attacker.`,
        drop: DROP[type],
      };
    case 'fork':
      return {
        prompt: `Your ${name} on ${square} is in a fork. Save what you would lose.`,
        note: `One enemy piece attacks your ${name} on ${square} and something else. Save the piece you would lose.`,
        drop: DROP[type],
      };
    case 'pin':
      return {
        prompt: `Your ${name} on ${square} is pinned to your king.`,
        note: `The ${name} on ${square} sits in front of your king. Do not step it off that line.`,
        drop: DROP[type],
      };
    case 'back_rank':
      return {
        prompt: 'Back-rank mate is one move away. Give the king a square, or block the rank.',
        note: 'A rook or queen can mate on the back rank. Make luft, or put something in the way.',
        drop: 10000,
      };
    case 'missed_mate':
      return {
        prompt: 'They can mate you next move. Stop that before you do anything else.',
        note: 'Mate in one is on the board. Stop that check. A longer mate is not the task.',
        drop: 10000,
      };
    default: {
      const exhaustive: never = theme;
      return exhaustive;
    }
  }
}

function weightOf(move: { piece: PieceSymbol; from: Square; to: Square; captured?: PieceSymbol; san: string }, ply: number, profile: Profile, lastTo: Square | null): number {
  let weight = 2;
  if (move.captured) weight += profile === 'back_rank' ? 5 : 3;
  if (move.san === 'O-O' || move.san === 'O-O-O') weight += 8;
  if ((move.piece === 'n' || move.piece === 'b') && (move.from[1] === '1' || move.from[1] === '8')) weight += 4;
  if (move.piece === 'p' && (move.to[0] === 'd' || move.to[0] === 'e')) weight += 2;
  if (ply < 8 && move.piece === 'q') weight = 1;
  if (lastTo && move.from === lastTo) weight = 1;
  if (profile === 'back_rank') {
    if (move.piece === 'p' && (move.from[0] === 'd' || move.from[0] === 'e')) weight += 3;
    if (move.piece === 'r') weight += 2;
    const luft =
      move.piece === 'p' &&
      (move.from[0] === 'a' || move.from[0] === 'b' || move.from[0] === 'g' || move.from[0] === 'h') &&
      (move.from[1] === '2' || move.from[1] === '7');
    if (luft) weight = 1;
  }
  if (profile === 'mate') {
    if (move.piece === 'q' || move.piece === 'b') weight += 3;
    if (move.to === 'h5' || move.to === 'h4' || move.to === 'f7' || move.to === 'f2') weight += 4;
  }
  return weight;
}

function pickMove(game: Chess, rand: () => number, profile: Profile, lastTo: Square | null) {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  const ply = game.history().length;
  let total = 0;
  const weights = moves.map((move) => {
    const weight = weightOf(move, ply, profile, lastTo);
    total += weight;
    return weight;
  });
  let ticket = rand() * total;
  for (let index = 0; index < moves.length; index += 1) {
    ticket -= weights[index] ?? 0;
    if (ticket <= 0) return moves[index] ?? null;
  }
  return moves[moves.length - 1] ?? null;
}

function varietyKey(theme: Theme, side: Color, square: Square, type: PieceSymbol): string {
  return `${theme}:${side}:${square}:${type}`;
}

function buildDrill(
  game: Chess,
  hit: Hit,
  id: string,
): Drill | null {
  const fen = game.fen();
  if (pieceCount(fen) < MIN_PIECES) return null;
  if (!materialIsReachable(fen)) return null;
  if (plausibilityIssues(fen).length > 0) return null;
  const piece = game.get(hit.square);
  if (!piece || piece.color !== game.turn()) return null;
  const side = game.turn();
  const saves: { uci: string; outcome: number; fromRisk: boolean; captured: boolean }[] = [];
  let blunder = false;
  for (const move of game.moves({ verbose: true })) {
    if (move.promotion) continue;
    const outcome = moveOutcome(fen, move.from, move.to, side);
    if (outcome === null) continue;
    if (outcome < 0) {
      blunder = true;
      continue;
    }
    saves.push({
      uci: `${move.from}${move.to}`,
      outcome,
      fromRisk: move.from === hit.square,
      captured: Boolean(move.captured),
    });
  }
  if (!blunder || saves.length === 0) return null;
  saves.sort((a, b) => {
    if (a.fromRisk !== b.fromRisk) return a.fromRisk ? -1 : 1;
    if (a.captured !== b.captured) return a.captured ? -1 : 1;
    return b.outcome - a.outcome;
  });
  const solution = saves.slice(0, 8).map((save) => save.uci);
  const text = copyFor(hit.theme, piece.type, hit.square);
  return {
    id,
    fen,
    sideToMove: side,
    theme: hit.theme,
    atRiskSquare: hit.square,
    prompt: text.prompt,
    solution,
    note: text.note,
    expectedDropCp: text.drop,
    acceptable: [...solution],
    traps: [],
  };
}

function chooseHit(
  game: Chess,
  hits: readonly Hit[],
  need: Record<Theme, number>,
  variety: Map<string, number>,
): Hit | null {
  const ranked = hits
    .filter((hit) => need[hit.theme] > 0)
    .sort((a, b) => need[b.theme] - need[a.theme] || a.theme.localeCompare(b.theme));
  for (const hit of ranked) {
    const piece = game.get(hit.square);
    if (!piece) continue;
    const key = varietyKey(hit.theme, game.turn(), hit.square, piece.type);
    if ((variety.get(key) ?? 0) >= VARIETY_CAP[hit.theme]) continue;
    return hit;
  }
  return null;
}

/** Shipping order of the hand-checked set. Guests still open on hang-q-01. */
const HAND_ORDER = [
  'hang-q-01',
  'hang-q-02',
  'hang-q-03',
  'hang-q-06',
  'hang-r-01',
  'hang-r-02',
  'hang-r-03',
  'hang-r-04',
  'hang-n-01',
  'hang-n-02',
  'hang-n-03',
  'hang-b-01',
  'hang-b-02',
  'hang-b-03',
  'hang-p-01',
  'hang-p-02',
  'fork-01',
  'fork-03',
  'fork-04',
  'fork-05',
  'fork-06',
  'pin-01',
  'pin-02',
  'pin-04',
  'pin-06',
  'back-01',
  'back-02',
  'mate-01',
  'mate-02',
  'mate-03',
];

function orderBank(drills: readonly Drill[]): Drill[] {
  const handRank = new Map(HAND_ORDER.map((id, index) => [id, index]));
  const hand: Drill[] = [];
  const buckets = new Map<Theme, Drill[]>(THEMES.map((theme) => [theme, []]));
  for (const drill of drills) {
    if (handRank.has(drill.id)) hand.push(drill);
    else buckets.get(drill.theme)?.push(drill);
  }
  hand.sort((a, b) => (handRank.get(a.id) ?? 0) - (handRank.get(b.id) ?? 0));
  for (const list of buckets.values()) {
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  const generated: Drill[] = [];
  let more = true;
  while (more) {
    more = false;
    for (const theme of THEMES) {
      const next = buckets.get(theme)?.shift();
      if (!next) continue;
      generated.push(next);
      more = true;
    }
  }
  return [...hand, ...generated];
}

function emptyNeed(): Record<Theme, number> {
  return { hanging: TARGET, fork: TARGET, pin: TARGET, back_rank: TARGET, missed_mate: TARGET };
}

function nextSerial(existing: readonly Drill[]): Record<Theme, number> {
  const serial: Record<Theme, number> = { hanging: 1, fork: 1, pin: 1, back_rank: 1, missed_mate: 1 };
  for (const drill of existing) {
    const match = new RegExp(`^${prefix(drill.theme)}-(\\d+)$`).exec(drill.id);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= serial[drill.theme]) serial[drill.theme] = value + 1;
  }
  return serial;
}

function search(
  profile: Profile,
  games: number,
  rand: () => number,
  need: Record<Theme, number>,
  seen: Set<string>,
  variety: Map<string, number>,
  serial: Record<Theme, number>,
  added: Drill[],
): void {
  const mates = profile !== 'develop';
  const maxPly = profile === 'develop' ? 24 : 42;
  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    if (THEMES.every((theme) => need[theme] <= 0)) return;
    if (profile === 'develop' && need.hanging <= 0 && need.fork <= 0 && need.pin <= 0) return;
    if (profile === 'back_rank' && need.back_rank <= 0) return;
    if (profile === 'mate' && need.missed_mate <= 0 && need.back_rank <= 0) return;
    const game = new Chess();
    let lastTo: Square | null = null;
    const took = new Set<Theme>();
    for (let ply = 0; ply < maxPly; ply += 1) {
      if (pieceCount(game.fen()) < MIN_PIECES) break;
      const move = pickMove(game, rand, profile, lastTo);
      if (!move) break;
      game.move(move);
      lastTo = move.to;
      if (game.isCheck() || game.isGameOver()) continue;
      if (pieceCount(game.fen()) < MIN_PIECES) break;
      const key = fenKey(game.fen());
      if (seen.has(key)) continue;
      const hits = findHits(game, need, mates).filter((hit) => !took.has(hit.theme));
      const hit = chooseHit(game, hits, need, variety);
      if (!hit) continue;
      const id = `${prefix(hit.theme)}-${String(serial[hit.theme]).padStart(2, '0')}`;
      const drill = buildDrill(game, hit, id);
      if (!drill) {
        seen.add(key);
        continue;
      }
      const piece = game.get(hit.square);
      if (!piece) continue;
      seen.add(key);
      took.add(hit.theme);
      variety.set(varietyKey(hit.theme, drill.sideToMove, hit.square, piece.type), (variety.get(varietyKey(hit.theme, drill.sideToMove, hit.square, piece.type)) ?? 0) + 1);
      serial[hit.theme] += 1;
      need[hit.theme] -= 1;
      added.push(drill);
      console.log(`${drill.id} ${drill.theme} ${drill.sideToMove} ${drill.atRiskSquare}  still ${THEMES.map((theme) => `${theme}:${need[theme]}`).join(' ')}`);
    }
    if ((gameIndex + 1) % 500 === 0) {
      console.log(`${profile} game ${gameIndex + 1}/${games}  ${THEMES.map((theme) => `${theme}:${need[theme]}`).join(' ')}`);
    }
  }
}

function readBank(): Drill[] {
  return JSON.parse(fs.readFileSync(OUT, 'utf8')) as Drill[];
}

/** A back-rank drill is the king on the first or eighth rank, with mate threatened there. */
function keepDrill(drill: Drill): boolean {
  if (drill.theme !== 'back_rank') return true;
  const rank = drill.sideToMove === 'w' ? '1' : '8';
  return drill.atRiskSquare[1] === rank;
}

const loaded = readBank();
const existing = loaded.filter(keepDrill);
if (existing.length !== loaded.length) {
  console.log(`Dropped ${loaded.length - existing.length} back-rank drills whose king is off the back rank`);
}
const need = emptyNeed();
for (const drill of existing) {
  if (THEMES.includes(drill.theme)) need[drill.theme] -= 1;
}
const seen = new Set(existing.map((drill) => fenKey(drill.fen)));
const variety = new Map<string, number>();
for (const drill of existing) {
  let piece: { type: PieceSymbol } | null = null;
  try {
    piece = new Chess(drill.fen).get(drill.atRiskSquare);
  } catch {
    piece = null;
  }
  if (!piece) continue;
  const key = varietyKey(drill.theme, drill.sideToMove, drill.atRiskSquare, piece.type);
  variety.set(key, (variety.get(key) ?? 0) + 1);
}
const serial = nextSerial(existing);
const added: Drill[] = [];
const rand = mulberry32(SEED);
const started = Date.now();
console.log(`Need ${THEMES.map((theme) => `${theme}:${Math.max(need[theme], 0)}`).join(' ')}`);
const developGames = Number(process.env.GROW_DEVELOP ?? 8000);
const backGames = Number(process.env.GROW_BACK ?? 20000);
const mateGames = Number(process.env.GROW_MATE ?? 20000);
search('develop', developGames, rand, need, seen, variety, serial, added);
search('back_rank', backGames, rand, need, seen, variety, serial, added);
search('mate', mateGames, rand, need, seen, variety, serial, added);
const ordered = orderBank([...existing, ...added]);
if (added.length > 0 || JSON.stringify(ordered) !== JSON.stringify(existing)) {
  fs.writeFileSync(OUT, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(`Wrote ${ordered.length} drills (${added.length} new) in ${Math.round((Date.now() - started) / 1000)}s`);
} else {
  console.log(`Bank already meets the target (${existing.length})`);
}
const short = THEMES.filter((theme) => need[theme] > 0);
if (short.length > 0) {
  console.error(`Still short: ${short.map((theme) => `${theme}:${need[theme]}`).join(' ')}`);
  process.exit(1);
}
