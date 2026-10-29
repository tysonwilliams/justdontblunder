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

function attackersOf(game, square, by) {
  const board = game.board();
  const out = [];
  let probe;
  try {
    probe = new Chess(withTurn(game.fen(), by));
  } catch {
    return out;
  }
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const p = board[r]?.[f];
      if (!p || p.color !== by) continue;
      const from = sq(f, 7 - r);
      if (probe.moves({ square: from, verbose: true }).some((m) => m.to === square)) {
        out.push({ from, type: p.type, val: VAL[p.type] });
      }
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

function validate(d) {
  let game;
  try {
    game = new Chess(d.fen);
  } catch (e) {
    return `bad fen: ${e.message}`;
  }
  if (pieceCount(d.fen) < MIN_PIECES) return `too sparse (${pieceCount(d.fen)} pcs)`;
  if (game.turn() !== d.sideToMove) return `turn mismatch`;
  const piece = game.get(d.atRiskSquare);
  if (!piece) return `no piece on ${d.atRiskSquare}`;
  if (piece.color !== d.sideToMove) return `wrong color`;

  const legal = game.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
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
    note: 'Nf6 attacks your unprotected queen. Retreat her now.',
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
    id: 'hang-q-04',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/3P3q/2N2N2/PPP1PPPP/R1BQKB1R b KQkq - 1 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Your queen is hanging to the knight — save her.',
    solution: ['h4f6', 'h4f4', 'h4g5', 'h4g3', 'h4h5', 'h4h6', 'h4h3', 'h4e7', 'h4d8'],
    note: 'Nf3 attacks your unprotected queen. Retreat before N×h4.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-q-05',
    fen: 'r1b1kbnr/pppp1ppp/2n5/4p3/3PP2q/5N2/PPP2PPP/RNBQKB1R b KQkq - 2 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Queen hanging again — pull her back.',
    solution: ['h4f6', 'h4f4', 'h4g5', 'h4g3', 'h4h5', 'h4h6', 'h4h3', 'h4e7', 'h4d8', 'h4e4'],
    note: 'Nf3 attacks Qh4. Save the queen.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-q-06',
    fen: 'rnb1kb1r/ppp1pppp/5n2/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 3 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'd5',
    prompt: 'Your queen is hanging under knight fire — relocate her.',
    solution: ['d5a5', 'd5d6', 'd5d7', 'd5d8', 'd5e6', 'd5f5', 'd5g5', 'd5h5', 'd5c6', 'd5c5', 'd5c4', 'd5b5', 'd5e4'],
    note: 'Nc3 attacks the unprotected queen. Move her before you drop her.',
    expectedDropCp: 900,
  },

  // ——— Hanging rooks ———
  {
    id: 'hang-r-01',
    fen: 'rnbqk2r/pppp1ppp/5n2/4p3/2B1P2r/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Your rook is hanging on h4 — save it.',
    solution: ['h4h5', 'h4h6', 'h4h3', 'h4h2', 'h4g4', 'h4f4', 'h4e4'],
    note: 'White’s knight (and more) can take the rook. Pull it back now.',
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
    prompt: 'Your rook is hanging to the knight — save it.',
    solution: ['h5h6', 'h5h7', 'h5h4', 'h5h3', 'h5g5', 'h5f5', 'h5e5', 'h5d5', 'h5c5', 'h5b5', 'h5a5'],
    note: 'Nf6 attacks your unprotected rook. Get it off h5.',
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
    note: 'White threatens dxe4. Retreat the knight or support with d5.',
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
    fen: 'rnbqkb1r/pppppppp/5n2/4P3/8/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 2',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'f6',
    prompt: 'A pawn attacks your knight — save it.',
    solution: ['f6d5', 'f6d7', 'f6g4', 'f6g8', 'f6h5', 'f6e4'],
    note: 'e5 hits Nf6 and the knight is unprotected. Move it.',
    expectedDropCp: 300,
  },
  {
    id: 'hang-n-04',
    fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e5',
    prompt: 'Your e-pawn is hanging — don’t ignore it.',
    solution: ['e5d4', 'd7d6', 'b8c6', 'f6e4', 'f6d5', 'f6g4'],
    note: 'White threatens dxe5. Capture on d4 or shore up e5.',
    expectedDropCp: 100,
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
    fen: 'rnbqk1nr/pppp1ppp/8/2b1p3/1PB1P3/8/P1PP1PPP/RNBQK1NR b KQkq - 0 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'c5',
    prompt: 'A pawn attacks your bishop — save it.',
    solution: ['c5b6', 'c5b4', 'c5d4', 'c5e7', 'c5d6', 'c5a3'],
    note: 'b4 hits the bishop. Retreat before bxc5.',
    expectedDropCp: 300,
  },
  {
    id: 'hang-b-03',
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p1b2/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 2 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'f5',
    prompt: 'Your bishop is hanging — pull it back.',
    solution: ['f5e6', 'f5d7', 'f5g6', 'f5g4', 'f5h3', 'f5e4'],
    note: 'White can take the loose bishop. Move it now.',
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
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e5',
    prompt: 'Your e-pawn is hanging to the knight — handle it.',
    solution: ['b8c6', 'd7d6', 'f7f6', 'd8e7', 'd8f6', 'g8f6'],
    note: 'Nf3 attacks e5. Defend the pawn or you’ll drop it.',
    expectedDropCp: 100,
  },

  // ——— Live forks (full boards) ———
  {
    id: 'fork-01',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/3nP3/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 6 6',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'f3',
    prompt: 'Knight forks your knight and bishop — save material.',
    solution: ['f3d4', 'f3e5', 'f3g5', 'f3h4', 'f3g1', 'f3d2', 'e2d3', 'e2c4', 'e2b5', 'e2a6', 'e2f1', 'd1d4'],
    note: 'Nd4 forks Nf3 and Be2. Capture the knight or move a forked piece.',
    expectedDropCp: 300,
  },
  {
    id: 'fork-02',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/3nP3/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 6 6',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'e2',
    prompt: 'Your bishop is forked with the knight — react.',
    solution: ['e2d3', 'e2c4', 'e2b5', 'e2a6', 'e2f1', 'f3d4', 'd1d4'],
    note: 'Nd4 hits Be2 and Nf3. Move the bishop or take on d4.',
    expectedDropCp: 300,
  },
  {
    id: 'fork-03',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3nP3/1Q3N2/PPP2PPP/RNB1KB1R w KQkq - 5 5',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'b3',
    prompt: 'Knight forks your queen and knight — save the queen.',
    solution: [
      'b3a4', 'b3b4', 'b3b5', 'b3b6', 'b3b7', 'b3c4', 'b3d5', 'b3e6', 'b3f7',
      'b3c3', 'b3d3', 'b3e3', 'b3a3', 'f3d4', 'f3e5', 'f3g5', 'f3h4', 'f3g1', 'f3d2',
    ],
    note: 'Nd4 forks Qb3 and Nf3. Move the queen (or take the knight).',
    expectedDropCp: 900,
  },
  {
    id: 'fork-04',
    fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/8/PPnP1PPP/RNBQKBNR w KQkq - 0 3',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'a1',
    prompt: 'Knight forks your king and rook — get out of it.',
    solution: ['d1c2', 'e1e2'],
    note: 'Nc2 checks the king and eyes Ra1. Take the knight or step the king.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-05',
    fen: 'rnbqkb1r/ppp2ppp/3p1n2/4p3/4P3/3n1N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'c1',
    prompt: 'Knight forks king and bishop — break the fork.',
    solution: ['c2d3', 'e1e2', 'f1d3'],
    note: 'Nd3 checks and hits Bc1. Capture the knight or walk the king.',
    expectedDropCp: 300,
  },
  {
    id: 'fork-06',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1n3/2NP1N2/PPPQ1PPP/R1B1K2R w KQkq - 0 6',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'd2',
    prompt: 'Knight forks your queen and knight — save the queen.',
    solution: [
      'd2e3', 'd2f4', 'd2g5', 'd2h6', 'd2e2', 'd2d1', 'd2c1', 'd2e1',
      'd2d3', 'd2d4', 'd2d5', 'd2d6', 'd2d7', 'd2d8',
      'c3e4', 'c3a4', 'c3b5', 'c3d5', 'c3b1', 'c3a2',
      'd3e4', 'f3e5', 'f3g5', 'f3d4',
    ],
    note: 'Ne4 forks Qd2 and Nc3. Move the queen or capture the knight.',
    expectedDropCp: 900,
  },
  {
    id: 'fork-07',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3nP3/1Q3N2/PPP2PPP/RNB1KB1R w KQkq - 5 5',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'f3',
    prompt: 'Your knight is forked with the queen — react.',
    solution: ['f3d4', 'f3e5', 'f3g5', 'f3h4', 'f3g1', 'f3d2', 'b3a4', 'b3b4', 'b3b5', 'b3c4', 'b3d5', 'b3c3', 'b3d3', 'b3e3', 'b3a3'],
    note: 'Nd4 forks Nf3 and Qb3. Take on d4 or move a forked piece.',
    expectedDropCp: 300,
  },

  // ——— Absolute pins ———
  {
    id: 'pin-01',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'c6',
    prompt: 'Your knight is pinned to the king — break the pin.',
    solution: ['a7a6', 'd7d6', 'g8e7', 'g8f6', 'd8e7', 'a7a5'],
    note: 'Bb5 pins Nc6 to the king. Play a6 or prepare to break it.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-02',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'c6',
    prompt: 'Ruy Lopez pin — your c6-knight can’t wander.',
    solution: ['a7a6', 'd7d6', 'f8c5', 'f8e7', 'd8e7'],
    note: 'Bb5 pins the knight to the king. Challenge with a6 or shore it up.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-03',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 6 5',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'c6',
    prompt: 'Still pinned — don’t hang the knight by moving it.',
    solution: ['a7a6', 'd7d6', 'e8g8', 'd8e7', 'c6e7'],
    note: 'The absolute pin on c6 remains. Break it before the knight wanders.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-04',
    fen: 'rnbqk2r/pppp1ppp/5n2/4p3/1b2P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'c3',
    prompt: 'Your knight is pinned to the king — unpin carefully.',
    solution: ['a2a3', 'd2d3', 'd1e2', 'e1e2', 'f1e2', 'f1d3', 'f1c4', 'f1b5'],
    note: 'Bb4 pins Nc3 to the king. Don’t move the knight off the pin line.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-05',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'c3',
    prompt: 'Pinned knight on c3 — break the pin or ignore safely.',
    solution: ['a2a3', 'd2d3', 'd1e2', 'e1e2', 'e1f1', 'e1g1', 'c3e2'],
    note: 'Black’s bishop pins Nc3. Step the king or challenge the bishop.',
    expectedDropCp: 40,
  },
  {
    id: 'pin-06',
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/4P1b1/5N2/PPPP1PPP/RNBKQB1R w kq - 4 4',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'f3',
    prompt: 'Your knight is pinned to the king — don’t move it blindly.',
    solution: ['e4e5', 'e4d5', 'h2h3', 'd1e2', 'e1e2', 'f1e2', 'f1d3', 'f1c4', 'f1b5', 'b1c3'],
    note: 'Bg4 pins Nf3 to the king on d1. Unpin before the knight runs.',
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
    fen: '1nb3k1/pp3ppp/2pp4/5n2/3P4/5N2/PPP2PPP/RNBQR1K1 b - - 0 9',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Stop Re8# — make luft now.',
    solution: ['g7g6', 'h7h6', 'h7h5', 'f7f6', 'f7f5', 'g8f8', 'g8h8', 'c6c5', 'f5d6', 'f5h6', 'f5h4', 'f5d4'],
    note: 'The e-file is open to your back rank. Create an escape square.',
    expectedDropCp: 10000,
  },
  {
    id: 'back-03',
    fen: '1nb3k1/ppp2ppp/3p4/5n2/2P5/1P1P1NP1/P4P1P/RNBQR1K1 b - - 0 10',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Back-rank mate is threatened — create an exit.',
    solution: ['g7g6', 'h7h6', 'h7h5', 'f7f6', 'f7f5', 'g8f8', 'g8h8', 'f5d6', 'f5h6', 'f5h4', 'f5d4', 'f5g3', 'f5e3'],
    note: 'White’s rook is ready for Re8#. Make luft immediately.',
    expectedDropCp: 10000,
  },
  {
    id: 'mate-01',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'f7',
    prompt: 'Scholar’s mate is threatened — stop Qxf7#.',
    solution: ['g7g6', 'd8e7'],
    note: 'Qe7 or g6 defends f7. Don’t let Qxf7# land.',
    expectedDropCp: 900,
  },
  {
    id: 'mate-02',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'f7',
    prompt: 'Stop Qxf7# right now.',
    solution: ['g7g6', 'd8e7', 'g8f6'],
    note: 'Defend f7 immediately or it’s scholar’s mate.',
    expectedDropCp: 900,
  },
  {
    id: 'mate-03',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 2',
    sideToMove: 'w',
    theme: 'missed_mate',
    atRiskSquare: 'e1',
    prompt: 'Fool’s mate is threatened — don’t get mated next move.',
    solution: ['f3f4', 'g4g5', 'e2e3', 'e2e4', 'b1c3', 'g1h3', 'd2d3', 'd2d4', 'c2c3', 'c2c4', 'd1e2'],
    note: 'Black threatens Qh4#. Block the diagonal or undo the damage.',
    expectedDropCp: 10000,
  },
  {
    id: 'mate-04',
    fen: 'rnbqkbnr/pppp1pp1/7p/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 1 3',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'f7',
    prompt: 'h6 didn’t help — stop Qxf7# now.',
    solution: ['g7g6', 'd8e7'],
    note: 'Qxf7# is still on. Defend f7 immediately.',
    expectedDropCp: 900,
  },
  {
    id: 'mate-05',
    fen: 'rnbqk1nr/pppp1ppp/8/2b1p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'f7',
    prompt: 'Bishop developed, but f7 is still mate — defend it.',
    solution: ['g7g6', 'd8e7', 'd8f6', 'g8f6'],
    note: 'Qxf7# is threatened. Cover f7 before anything else.',
    expectedDropCp: 900,
  },
];

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

fs.writeFileSync(
  new URL('../src/data/beginner-blunders.json', import.meta.url),
  `${JSON.stringify(kept, null, 2)}\n`,
);
console.log(`Wrote ${kept.length} full-board immediate-danger drills (min ${MIN_PIECES} pieces)`);
