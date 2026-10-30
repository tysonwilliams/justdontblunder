/**
 * Build full-board drills with IMMEDIATE danger only:
 * - hanging: attacked & (undefended OR attacked by cheaper unit)
 * - fork: enemy piece attacks atRisk AND another high-value friendly (incl. king)
 * - pin: absolute pin (slider through piece to king)
 * - back_rank / missed_mate: opponent threatens mate in 1
 *
 * Positions must look like real games (MIN_PIECES), not sparse endgame puzzles.
 */
import { Chess } from 'chess.js';
import fs from 'node:fs';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const FILES = 'abcdefgh';
const RANKS = '12345678';
const MIN_PIECES = 24;

function sq(file, rank) {
  return `${FILES[file]}${RANKS[rank]}`;
}

function pieceCount(fen) {
  return fen.split(' ')[0].replace(/\d/g, '').replace(/\//g, '').length;
}

function withTurn(fen, turn) {
  const parts = fen.split(' ');
  parts[1] = turn;
  return parts.join(' ');
}

function aligned(a, b, c) {
  const af = FILES.indexOf(a[0]);
  const ar = RANKS.indexOf(a[1]);
  const bf = FILES.indexOf(b[0]);
  const br = RANKS.indexOf(b[1]);
  const cf = FILES.indexOf(c[0]);
  const cr = RANKS.indexOf(c[1]);
  return (bf - af) * (cr - ar) === (br - ar) * (cf - af);
}

/** Slider that pins `square` to its own king, if any. */
function pinSource(game, square, color) {
  const kingSq = findKing(game, color);
  if (!kingSq || kingSq === square) return null;
  const opp = color === 'w' ? 'b' : 'w';
  const kf = FILES.indexOf(kingSq[0]);
  const kr = RANKS.indexOf(kingSq[1]);
  const sf = FILES.indexOf(square[0]);
  const sr = RANKS.indexOf(square[1]);
  const board = game.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = board[r]?.[f];
      if (!p || p.color !== opp || !['b', 'r', 'q'].includes(p.type)) continue;
      const from = sq(f, 7 - r);
      const ar = 7 - r;
      if (!rawAttacks(game, from, square)) continue;
      if (between(f, ar, sf, sr, kf, kr)) return from;
    }
  }
  return null;
}

/**
 * Pieces that can capture on `square`.
 * Ignores "the attacker is in check right now" so a spite check does not
 * count as saving a hanging piece. Still respects absolute pins.
 */
function attackersOf(game, square, by) {
  const board = game.board();
  const out = [];
  const kingSq = findKing(game, by);
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = board[r]?.[f];
      if (!p || p.color !== by) continue;
      const from = sq(f, 7 - r);
      if (!rawAttacks(game, from, square)) continue;
      const pinner = pinSource(game, from, by);
      if (pinner && kingSq && square !== pinner && !aligned(from, square, kingSq)) continue;
      out.push({ from, type: p.type, val: VAL[p.type] });
    }
  }
  return out;
}

function findKing(game, color) {
  const board = game.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = board[r]?.[f];
      if (p?.type === 'k' && p.color === color) return sq(f, 7 - r);
    }
  }
  return null;
}

function between(ax, ay, bx, by, cx, cy) {
  const onLine =
    (ax === bx && bx === cx) ||
    (ay === by && by === cy) ||
    (Math.abs(ax - bx) === Math.abs(ay - by) &&
      Math.abs(bx - cx) === Math.abs(by - cy) &&
      Math.sign(bx - ax) === Math.sign(cx - bx) &&
      Math.sign(by - ay) === Math.sign(cy - by));
  if (!onLine) return false;
  return (
    bx >= Math.min(ax, cx) &&
    bx <= Math.max(ax, cx) &&
    by >= Math.min(ay, cy) &&
    by <= Math.max(ay, cy) &&
    !(bx === ax && by === ay) &&
    !(bx === cx && by === cy)
  );
}

function isTrulyHanging(game, square, side) {
  const piece = game.get(square);
  if (!piece || piece.color !== side || piece.type === 'k') return false;
  const opp = side === 'w' ? 'b' : 'w';
  if (!game.isAttacked(square, opp)) return false;
  const atk = attackersOf(game, square, opp);
  if (!atk.length) return false;
  const defended = game.isAttacked(square, side);
  const cheapest = Math.min(...atk.map((a) => a.val));
  return !defended || cheapest < VAL[piece.type];
}

function pathClear(game, from, to) {
  const af = FILES.indexOf(from[0]);
  const ar = RANKS.indexOf(from[1]);
  const tf = FILES.indexOf(to[0]);
  const tr = RANKS.indexOf(to[1]);
  const dx = Math.sign(tf - af);
  const dy = Math.sign(tr - ar);
  let f = af + dx;
  let r = ar + dy;
  while (f !== tf || r !== tr) {
    if (game.get(sq(f, r))) return false;
    f += dx;
    r += dy;
  }
  return true;
}

/** Attack test that works against kings (legal-move generation will not). */
function rawAttacks(game, from, to) {
  const p = game.get(from);
  if (!p) return false;
  const af = FILES.indexOf(from[0]);
  const ar = RANKS.indexOf(from[1]);
  const tf = FILES.indexOf(to[0]);
  const tr = RANKS.indexOf(to[1]);
  const dx = tf - af;
  const dy = tr - ar;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  switch (p.type) {
    case 'n':
      return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
    case 'k':
      return adx <= 1 && ady <= 1 && (adx > 0 || ady > 0);
    case 'p': {
      const dir = p.color === 'w' ? 1 : -1;
      return adx === 1 && dy === dir;
    }
    case 'b':
      return adx === ady && adx > 0 && pathClear(game, from, to);
    case 'r':
      return (dx === 0 || dy === 0) && adx + ady > 0 && pathClear(game, from, to);
    case 'q':
      return (
        ((dx === 0 || dy === 0) || adx === ady) &&
        adx + ady > 0 &&
        pathClear(game, from, to)
      );
    default:
      return false;
  }
}

function isLiveForkOn(game, square, side) {
  const piece = game.get(square);
  if (!piece || piece.color !== side) return false;
  const opp = side === 'w' ? 'b' : 'w';
  const board = game.board();
  const friendly = [];
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = board[r]?.[f];
      if (!p || p.color !== side) continue;
      if (p.type === 'k' || VAL[p.type] >= 3) friendly.push(sq(f, 7 - r));
    }
  }
  if (!friendly.includes(square)) friendly.push(square);

  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = board[r]?.[f];
      if (!p || p.color !== opp) continue;
      const from = sq(f, 7 - r);
      const hits = friendly.filter((t) => rawAttacks(game, from, t));
      if (hits.includes(square) && hits.length >= 2) return true;
    }
  }
  return false;
}

function isAbsolutePin(game, square, side) {
  const piece = game.get(square);
  if (!piece || piece.color !== side || piece.type === 'k') return false;
  const kingSq = findKing(game, side);
  if (!kingSq) return false;
  // The square between the piece and its king must be empty. A pawn on that
  // line (d7 in a Bb5/Nc6 position) means there is no pin.
  if (!pathClear(game, square, kingSq)) return false;
  const opp = side === 'w' ? 'b' : 'w';
  const atk = attackersOf(game, square, opp);
  const kf = FILES.indexOf(kingSq[0]);
  const kr = RANKS.indexOf(kingSq[1]);
  const sf = FILES.indexOf(square[0]);
  const sr = RANKS.indexOf(square[1]);
  for (const a of atk) {
    if (!['b', 'r', 'q'].includes(a.type)) continue;
    const af = FILES.indexOf(a.from[0]);
    const ar = RANKS.indexOf(a.from[1]);
    if (between(af, ar, sf, sr, kf, kr)) return true;
  }
  return false;
}

/** Extra officers have to be paid for by a missing pawn. Stops the generator from cloning an attacker onto the board. */
function materialReachable(fen) {
  const game = new Chess(fen);
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      counts[piece.color][piece.type] += 1;
    }
  }
  for (const color of ['w', 'b']) {
    const tally = counts[color];
    if (tally.k !== 1 || tally.p > 8) return false;
    const extras =
      Math.max(0, tally.q - 1) +
      Math.max(0, tally.r - 2) +
      Math.max(0, tally.b - 2) +
      Math.max(0, tally.n - 2);
    if (extras > 8 - tally.p) return false;
  }
  return true;
}

function opponentThreatensMateInOne(fen, side) {
  const opp = side === 'w' ? 'b' : 'w';
  let probe;
  try {
    probe = new Chess(withTurn(fen, opp));
  } catch {
    return false;
  }
  for (const m of probe.moves({ verbose: true })) {
    const g = new Chess(probe.fen());
    g.move(m);
    if (g.isCheckmate()) return true;
  }
  return false;
}

function squareAfterMove(after, move, risk, side, type) {
  if (move.from === risk) {
    const landed = after.get(move.to);
    if (landed?.color === side && landed.type === type) return move.to;
    return null;
  }
  const stayed = after.get(risk);
  if (stayed?.color === side && stayed.type === type) return risk;
  return null;
}

/** Legal moves that actually remove the immediate danger. */
function movesThatSave(d) {
  const before = new Chess(d.fen);
  const piece = before.get(d.atRiskSquare);
  const saved = [];
  for (const move of before.moves({ verbose: true })) {
    const after = new Chess(d.fen);
    const played = after.move(move);
    if (!played || after.isCheckmate()) continue;

    if (d.theme === 'hanging' || d.theme === 'fork') {
      const square = squareAfterMove(after, played, d.atRiskSquare, d.sideToMove, piece.type);
      if (!square) continue;
      const stillDanger =
        d.theme === 'hanging'
          ? isTrulyHanging(after, square, d.sideToMove)
          : isLiveForkOn(after, square, d.sideToMove);
      if (!stillDanger) saved.push(`${played.from}${played.to}${played.promotion ?? ''}`);
      continue;
    }

    if (d.theme === 'back_rank' || d.theme === 'missed_mate') {
      if (!opponentThreatensMateInOne(after.fen(), d.sideToMove)) {
        saved.push(`${played.from}${played.to}${played.promotion ?? ''}`);
      }
    }
  }
  return saved;
}

function validate(d) {
  let game;
  try {
    game = new Chess(d.fen);
  } catch (e) {
    return `bad fen: ${e.message}`;
  }
  if (!materialReachable(d.fen)) return 'unreachable material (attacker cloned onto the board)';
  if (pieceCount(d.fen) < MIN_PIECES) return `too sparse (${pieceCount(d.fen)} pcs)`;
  if (game.turn() !== d.sideToMove) return `turn mismatch`;
  const piece = game.get(d.atRiskSquare);
  if (!piece) return `no piece on ${d.atRiskSquare}`;
  if (piece.color !== d.sideToMove) return `wrong color`;

  const legal = game.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
  // Pass/fail is material safety minus the precomputed traps in src/logic/drills.ts.
  // This script only keeps a legal teaching move; refresh-acceptable.mts rewrites the full set.
  d.solution = d.solution.filter((sol) => legal.some((u) => u.startsWith(sol.slice(0, 4))));
  if (!d.solution.length) return `no legal solution`;

  if (d.theme === 'hanging' && !isTrulyHanging(game, d.atRiskSquare, d.sideToMove)) {
    return 'not truly hanging';
  }
  if (d.theme === 'fork' && !isLiveForkOn(game, d.atRiskSquare, d.sideToMove)) {
    return 'not a live fork';
  }
  if (d.theme === 'pin' && !isAbsolutePin(game, d.atRiskSquare, d.sideToMove)) {
    return 'not an absolute pin';
  }
  if (
    (d.theme === 'back_rank' || d.theme === 'missed_mate') &&
    !opponentThreatensMateInOne(d.fen, d.sideToMove)
  ) {
    return 'no mate-in-1 threat';
  }
  return null;
}

/** Full-board opening/middlegame save-your-piece drills. */
const drills = [
  // ——— Hanging queens ———
  {
    id: 'hang-q-01',
    fen: 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'h5',
    prompt: 'Your queen is hanging — get her to safety.',
    solution: ['h5e2', 'h5f3', 'h5g4', 'h5g5', 'h5g6', 'h5h3', 'h5h4', 'h5h6', 'h5f5', 'h5d1'],
    note: 'Nf6 attacks the queen. Move her to a square that piece does not hit — g4, g6, and h6 are still hanging.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-q-02',
    fen: 'rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'd5',
    prompt: 'Your queen is loose in the center — save her.',
    solution: ['d5a5', 'd5d6', 'd5d7', 'd5d8', 'd5e6', 'd5f5', 'd5g5', 'd5h5', 'd5c6', 'd5c5', 'd5c4', 'd5b5'],
    note: 'Nc3 attacks the unprotected queen. Move her off d5.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-q-03',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Your queen is hanging to the knight — move her.',
    solution: ['h4f6', 'h4f4', 'h4g5', 'h4g3', 'h4h5', 'h4h6', 'h4h3', 'h4e7', 'h4d8', 'h4e4'],
    note: 'Nf3 attacks the queen. Get her off h4 before N×h4.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-q-06',
    fen: 'rnb1kbnr/pppp1ppp/8/q3p3/4P3/1N6/PPPP1PPP/R1BQKBNR b KQkq - 1 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'a5',
    prompt: 'Your queen on the queenside is hanging — move her.',
    solution: ['a5a6'],
    note: 'Nb3 attacks the queen on a5. Get her off that square.',
    expectedDropCp: 900,
  },

  // ——— Hanging rooks ———
  {
    id: 'hang-r-01',
    fen: 'rnbqk3/pppp1ppp/5n2/4p3/2B1P2r/5N2/PPPP1PPP/RNBQK2R b KQq - 2 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Your rook is hanging on h4 — save it.',
    solution: ['h4h5', 'h4h6', 'h4h3', 'h4h2', 'h4g4', 'h4f4', 'h4e4'],
    note: 'Nf3 attacks the rook on h4. Move the rook before it is taken.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-r-02',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/4r3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 5',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e5',
    prompt: 'Your rook is hanging in the center — move it.',
    solution: ['e5e6', 'e5e7', 'e5f5', 'e5g5', 'e5h5', 'e5e4', 'e5d5', 'e5c5', 'e5b5', 'e5a5'],
    note: 'The rook on e5 is unprotected and attacked. Relocate it.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-r-03',
    fen: 'rnbqkb1r/pppppppp/5n2/7R/4P3/8/PPPP1PPP/RNBQKBN1 w Qkq - 0 3',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'h5',
    prompt: 'Your rook is hanging to the knight — make everything safe.',
    solution: ['h5h6', 'h5h7', 'h5h4', 'h5h3', 'h5g5', 'h5f5', 'h5e5', 'h5d5', 'h5c5', 'h5b5', 'h5a5'],
    note: 'Nf6 attacks your unprotected rook. Make everything safe — move the rook, defend it, or deal with the knight.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-r-04',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P2R/8/PPPP1PPP/RNBQKBN1 w Qkq - 0 3',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Your rook is hanging to the queen — retreat.',
    solution: ['h4h5', 'h4h6', 'h4h7', 'h4h3', 'h4g4', 'h4f4'],
    note: 'Black’s queen eyes Rh4. Move the rook before Q×h4.',
    expectedDropCp: 500,
  },

  // ——— Hanging knights ———
  {
    id: 'hang-n-01',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/4n3/3P1N2/PPP2PPP/RNBQKB1R b KQkq - 0 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e4',
    prompt: 'Your knight on e4 is hanging — save it.',
    solution: ['e4f6', 'e4c5', 'e4c3', 'e4d6', 'e4g5', 'e4g3', 'e4f2', 'e4d2', 'd7d5'],
    note: 'The pawn on d3 attacks the knight. Nf6 gets it home. Ng5 walks into Nxg5.',
    expectedDropCp: 300,
  },
  {
    id: 'hang-n-02',
    fen: 'rnbqkb1r/ppp2ppp/3p1n2/4P3/8/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'f6',
    prompt: 'A pawn attacks your knight — don’t freeze.',
    solution: ['f6d7', 'f6d5', 'f6e4', 'f6g4', 'f6g8', 'f6h5', 'd6e5'],
    note: 'exf6 wins the knight. Move it or take on e5.',
    expectedDropCp: 300,
  },
  {
    id: 'hang-n-03',
    fen: 'r1bqkbnr/pppp1ppp/8/1p6/2N1P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'c4',
    prompt: 'A pawn attacks your knight on c4 — save it.',
    solution: ['c4a3'],
    note: 'b5 hits the knight. Move it before it drops.',
    expectedDropCp: 300,
  },

  // ——— Hanging bishops ———
  {
    id: 'hang-b-01',
    fen: 'rnbqk1nr/pppp1ppp/8/4p3/1bB1P3/2P5/PP1P1PPP/RNBQK1NR b KQkq - 0 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'b4',
    prompt: 'Your bishop is attacked by a pawn — save it.',
    solution: ['b4a5', 'b4c5', 'b4e7', 'b4d6', 'b4a3', 'b4c3'],
    note: 'c3 hits the bishop. Retreat before cxb4.',
    expectedDropCp: 300,
  },
  {
    id: 'hang-b-02',
    fen: 'rnbqkbnr/ppp2ppp/8/3p4/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'c4',
    prompt: 'Your bishop on c4 is hanging — save it.',
    solution: ['c4b3'],
    note: 'd5 hits the bishop. Move it or take on d5.',
    expectedDropCp: 300,
  },
  {
    id: 'hang-b-03',
    fen: 'rn1qkb1r/ppp1pppp/5n2/3p1b2/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq - 2 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'f5',
    prompt: 'Your bishop is hanging — make everything safe.',
    solution: ['f5e6', 'f5d7', 'f5g6', 'f5g4', 'f5h3', 'f5e4'],
    note: 'The e-pawn attacks your bishop on f5. Make everything safe — move the bishop, or deal with the pawn.',
    expectedDropCp: 300,
  },

  // ——— Hanging pawns ———
  {
    id: 'hang-p-01',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e5',
    prompt: 'Your e-pawn is hanging — don’t ignore it.',
    solution: ['e5d4', 'e5e4', 'd7d6', 'b8c6', 'g8f6'],
    note: 'White threatens dxe5. Capture on d4 or defend e5.',
    expectedDropCp: 100,
  },
  {
    id: 'hang-p-02',
    fen: 'rnbqkbnr/pppp1ppp/8/8/4p3/2N5/PPPPPPPP/R1BQKBNR b KQkq - 0 2',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e4',
    prompt: 'Your advanced pawn is loose — save it or defend it.',
    solution: ['e4e3'],
    note: 'Nc3 attacks the pawn on e4, and nothing defends it.',
    expectedDropCp: 100,
  },

  // ——— Live forks (full boards) ———
  {
    id: 'fork-01',
    fen: 'r1bqkb1r/pppp1ppp/5n2/4p3/3nP3/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 4 5',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'f3',
    prompt: 'Knight forks your knight and bishop — save material.',
    solution: ['f3d4', 'f3e5', 'f3g5', 'f3h4', 'f3g1', 'f3d2', 'e2d3', 'e2c4', 'e2b5', 'e2a6', 'e2f1', 'd1d4'],
    note: 'Nd4 forks Nf3 and Be2. Capture the knight or move a forked piece to safety.',
    expectedDropCp: 300,
  },
  {
    id: 'fork-03',
    fen: 'r1bqkbnr/pppp1ppp/8/4p3/3nP3/1Q3N2/PPP2PPP/RNB1KB1R w KQkq - 1 4',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'b3',
    prompt: 'A knight forks your queen and knight — make everything safe.',
    solution: [
      'b3a4', 'b3b4', 'b3b5', 'b3b6', 'b3b7', 'b3c4', 'b3d5', 'b3e6', 'b3f7',
      'b3c3', 'b3d3', 'b3e3', 'b3a3', 'f3d4', 'f3e5', 'f3g5', 'f3h4', 'f3g1', 'f3d2',
    ],
    note: 'Nd4 forks Qb3 and Nf3. Make both pieces safe — take the knight, or move a piece only when the other one stays safe.',
    expectedDropCp: 900,
  },
  {
    id: 'fork-04',
    fen: 'r1bqkb1r/pppp1ppp/5n2/4p3/2B1P3/2NP1N2/PPn2PPP/R1BQK2R w KQkq - 0 6',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'a1',
    prompt: 'Knight forks your king and rook — take the knight.',
    solution: ['d1c2', 'e1e2'],
    note: 'Nxc2 checks and attacks the rook on a1. Qxc2 wins the knight. Stepping the king aside loses the rook.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-05',
    fen: 'r1bqkb1r/ppp2ppp/3p1n2/4p3/4P3/3n1N2/PPPP1PPP/RNBQKB1R w KQkq - 2 4',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'c1',
    prompt: 'Knight forks your king and bishop — take it.',
    solution: ['c2d3', 'e1e2', 'f1d3'],
    note: 'Nd3 checks and hits the bishop on c1. Capture the knight. Walking the king loses the bishop.',
    expectedDropCp: 300,
  },
  {
    id: 'fork-06',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/2NP1N2/PPPQ1PPP/R1B1K2R w KQkq - 2 6',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'd2',
    prompt: 'The knight on e4 forks your queen and knight.',
    solution: [
      'd2e3', 'd2f4', 'd2g5', 'd2h6', 'd2e2', 'd2d1', 'd2c1', 'd2e1',
      'd2d3', 'd2d4', 'd2d5', 'd2d6', 'd2d7', 'd2d8',
      'c3e4', 'c3a4', 'c3b5', 'c3d5', 'c3b1', 'c3a2',
      'd3e4', 'f3e5', 'f3g5', 'f3d4',
    ],
    note: 'Ne4 attacks Qd2 and Nc3. Capture the knight. Moving only the queen leaves the other piece to be taken.',
    expectedDropCp: 900,
  },

  // ——— Absolute pins ———
  {
    id: 'pin-01',
    fen: 'r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 1 4',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'c6',
    prompt: 'Your knight is pinned to the king — break the pin.',
    solution: ['a7a6', 'd7d6', 'g8e7', 'g8f6', 'd8e7', 'a7a5'],
    note: 'Bb5 pins Nc6 to the king along the empty diagonal. a6 kicks the bishop. Moving the knight off the diagonal is illegal.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-02',
    fen: 'r1bqkbnr/pppp1ppp/4n3/8/8/8/PPPP1PPP/RNBQR1K1 b kq - 1 4',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'e6',
    prompt: 'A rook pins your knight to the king — make everything safe.',
    solution: ['d8e7', 'f8e7', 'g8e7', 'e8e7'],
    note: 'Re1 pins Ne6 to the king. Make everything safe. Blocking the file is one way.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-04',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/1b2P3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 1 5',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'c3',
    prompt: 'Your knight on c3 is pinned to the king.',
    solution: ['a2a3', 'd2d3', 'd1e2', 'e1e2', 'f1e2', 'f1d3', 'f1c4', 'f1b5'],
    note: 'Bb4 pins Nc3 to the king. The d-pawn has left d2, so the line is open. Do not move the knight off that diagonal.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-06',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/8/1b1NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 1 6',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'c3',
    prompt: 'Your knight on c3 is pinned to the king.',
    solution: ['e4e5', 'e4d5', 'h2h3', 'd1e2', 'e1e2', 'f1e2', 'f1d3', 'f1c4', 'f1b5', 'b1c3'],
    note: 'Bb4 pins Nc3 to the king. Deal with the bishop before you move that knight.',
    expectedDropCp: 40,
  },

  // ——— Back-rank / mate-in-1 threats ———
  {
    id: 'back-01',
    fen: '1nb3k1/ppp2ppp/3p4/5n2/8/3P1N2/PPP2PPP/RNBQR1K1 b - - 0 8',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Back-rank mate is one move away — breathe.',
    solution: ['g7g6', 'h7h6', 'h7h5', 'f7f6', 'f7f5', 'g8f8', 'g8h8', 'f5d6', 'f5h6', 'f5h4', 'f5d4', 'f5g3', 'f5e3'],
    note: 'White threatens Re8#. Make luft or step the king.',
    expectedDropCp: 10000,
  },
  {
    id: 'back-02',
    fen: 'r1bqr1k1/pp3ppp/2p2n2/3p4/8/Q7/PPP2NPP/RNB1R1K1 w - - 0 12',
    sideToMove: 'w',
    theme: 'back_rank',
    atRiskSquare: 'g1',
    prompt: 'Stop Rxe1# — your king is stuck on the back rank.',
    solution: ['g2g3'],
    note: 'Black’s rook on the open e-file threatens Rxe1#. Block the file or give the king air.',
    expectedDropCp: 10000,
  },
  {
    id: 'mate-01',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'f7',
    prompt: 'Scholar’s mate is threatened — stop Qxf7#. The queen on h5 is loose.',
    solution: ['g7g6', 'd8e7'],
    note: 'Nxh5 wins the queen. g6 attacks the queen; it does not defend f7. Qe7 stops Qxf7# as well.',
    expectedDropCp: 900,
  },
  {
    id: 'mate-02',
    fen: 'rnb3k1/pp3ppp/2p5/4p3/4P3/5N2/PP3PPP/RNBQ1RK1 b - - 0 8',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'g8',
    prompt: 'The queen mates on d8 next — stop Qd8#.',
    solution: ['f7f6', 'g7g6', 'c8d7', 'c8e6', 'b8d7', 'a8a7'],
    note: 'Qd8# comes down the open d-file. Nd7 or f6 stops it without hanging a pawn. A longer mate is not the task — but do not drop the e-pawn to Nxe5.',
    expectedDropCp: 10000,
  },
  {
    id: 'mate-03',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 2',
    sideToMove: 'w',
    theme: 'missed_mate',
    atRiskSquare: 'e1',
    prompt: 'Fool’s mate is threatened — don’t get mated next move.',
    solution: ['f3f4', 'g4g5', 'e2e3', 'e2e4', 'b1c3', 'g1h3', 'd2d3', 'd2d4', 'c2c3', 'c2c4', 'd1e2'],
    note: 'h4 occupies the square the queen wants. g5 stops Qh4# but Qxg5 wins the pawn. The king can also step out. Pushing the f-pawn does not stop the mate.',
    expectedDropCp: 10000,
  },
];

/**
 * Two-move traps from the drill audit. Each move is safe on the one-move material
 * rule (nothing hangs, no mate in 1) but a short tactic still wins material.
 * Lines are Stockfish depth-12 refutations, checked by replaying them here.
 * The app reads `traps` at runtime and does not search.
 */
const TRAPS = {
  'hang-q-02': [
    {
      move: 'd5c6',
      line: ['f1b5', 'c8f5', 'b5c6'],
      explanation: 'Careful: after Qc6, Bb5 pins your queen to your king and you lose it.',
    },
  ],
  'hang-n-01': [
    {
      move: 'f8b4',
      line: ['c2c3', 'e4f2', 'e1f2'],
      explanation: 'Careful: after Bb4+, c3 attacks that bishop, and your knight on e4 is lost for a pawn.',
    },
  ],
  'hang-b-03': [
    {
      move: 'f5e6',
      line: ['e4e5', 'f6g8', 'f3g5'],
      explanation: 'Careful: after Be6, e5 kicks your knight and Ng5 attacks your bishop.',
    },
    {
      move: 'f5c8',
      line: ['e4d5', 'f6d5', 'c3d5'],
      explanation: 'Careful: after Bc8, exd5 takes your pawn and Nxd5 takes the knight that recaptures.',
    },
  ],
  'fork-01': [
    {
      move: 'f3g5',
      line: ['d4e2'],
      explanation: 'Careful: after Ng5, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'f3g1',
      line: ['d4e2'],
      explanation: 'Careful: after Ng1, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'f3d2',
      line: ['d4e2'],
      explanation: 'Careful: after Nd2, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'e2b5',
      line: ['d4b5', 'c3b5'],
      explanation: 'Careful: after Bb5, Nxb5 takes your bishop.',
    },
    {
      move: 'g2g3',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after g3, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'h2h4',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after h4, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'a1b1',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after Rb1, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'c1d2',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after Bd2, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'd1d2',
      line: ['d4e2', 'd2e2'],
      explanation: 'Careful: after Qd2, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'd1d3',
      line: ['d4e2', 'd3e2'],
      explanation: 'Careful: after Qd3, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'e1d2',
      line: ['f8b4', 'f3e5', 'd8e7', 'a2a3', 'f6e4', 'd2e1', 'b4c3'],
      explanation: 'Careful: after Kd2, Bb4 pins your knight on c3 to your king and Bxc3 takes it.',
    },
    {
      move: 'e1f1',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after Kf1, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'h1g1',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after Rg1, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
    {
      move: 'h1f1',
      line: ['d4e2', 'd1e2'],
      explanation: 'Careful: after Rf1, Nxe2 takes your bishop. The knight on d4 was still forking it.',
    },
  ],
  'fork-03': [
    {
      move: 'b3c3',
      line: ['f8b4', 'f3d4', 'b4c3'],
      explanation: 'Careful: after Qc3, Bb4 pins your queen to your king and you lose it.',
    },
  ],
  'fork-06': [
    {
      move: 'c3e4',
      line: ['d7d5', 'c4b3', 'd5e4'],
      explanation: 'Careful: after Nxe4, d5 attacks that knight and dxe4 wins it back.',
    },
    {
      move: 'd2e3',
      line: ['e4c3'],
      explanation: 'Careful: after Qe3, Nxc3 takes your knight. Moving the queen left it in the fork.',
    },
    {
      move: 'd2e2',
      line: ['e4c3'],
      explanation: 'Careful: after Qe2, Nxc3 takes your knight. Moving the queen left it in the fork.',
    },
    {
      move: 'd2d1',
      line: ['e4c3'],
      explanation: 'Careful: after Qd1, Nxc3 takes your knight. Moving the queen left it in the fork.',
    },
  ],
  'back-02': [
    {
      move: 'f2d3',
      line: ['d8b6', 'g1h1', 'e8e1'],
      explanation: 'Careful: after Nd3, Qb6+ checks and Rxe1+ takes your rook.',
    },
  ],
};

function replayTrap(drill, trap) {
  const game = new Chess(drill.fen);
  const played = game.move({
    from: trap.move.slice(0, 2),
    to: trap.move.slice(2, 4),
    promotion: 'q',
  });
  if (!played) return `${drill.id} ${trap.move} is illegal`;
  for (const uci of trap.line) {
    const next = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    if (!next) return `${drill.id} ${trap.move} refutation ${uci} does not play`;
  }
  return null;
}

const kept = [];
const rejected = [];
for (const d of drills) {
  const err = validate(d);
  if (err) rejected.push(`${d.id}: ${err}`);
  else kept.push(d);
}

console.log(`Kept ${kept.length}, rejected ${rejected.length}`);
if (rejected.length) console.log(rejected.join('\n'));

if (kept.length < 30) {
  console.error(`Too few drills (${kept.length}); need at least 30 full-board immediate-danger positions`);
  process.exit(1);
}

const sparse = kept.filter((d) => pieceCount(d.fen) < MIN_PIECES);
if (sparse.length) {
  console.error('Sparse drills slipped through:', sparse.map((d) => d.id).join(', '));
  process.exit(1);
}

const outUrl = new URL('../src/data/beginner-blunders.json', import.meta.url);
let previous = [];
try {
  previous = JSON.parse(fs.readFileSync(outUrl, 'utf8'));
} catch {
  previous = [];
}
const prevById = new Map(previous.map((drill) => [drill.id, drill]));
let trapCount = 0;
for (const drill of kept) {
  const old = prevById.get(drill.id);
  if (old && old.fen === drill.fen && Array.isArray(old.acceptable) && old.acceptable.length) {
    drill.acceptable = old.acceptable;
    drill.solution = old.solution;
  } else {
    console.warn(`${drill.id}: fen changed — run scripts/refresh-acceptable.mts to rebuild the engine window`);
  }
  drill.traps = TRAPS[drill.id] ?? [];
  trapCount += drill.traps.length;
  for (const trap of drill.traps) {
    const err = replayTrap(drill, trap);
    if (err) {
      console.error(err);
      process.exit(1);
    }
    if ((drill.acceptable ?? []).some((sol) => sol.startsWith(trap.move))) {
      console.error(`${drill.id} ${trap.move} is a trap but still sits in the teaching window`);
      process.exit(1);
    }
  }
}
if (trapCount !== 24) {
  console.error(`Expected 24 two-move traps, found ${trapCount}`);
  process.exit(1);
}

fs.writeFileSync(outUrl, `${JSON.stringify(kept, null, 2)}\n`);
console.log(`Wrote ${kept.length} full-board immediate-danger drills (min ${MIN_PIECES} pieces)`);
