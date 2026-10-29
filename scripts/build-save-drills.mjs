/**
 * Build drills with IMMEDIATE danger only:
 * - hanging: attacked & (undefended OR attacked by cheaper unit)
 * - fork: enemy piece attacks atRisk AND another high-value friendly (incl. king)
 * - pin: absolute pin (slider through piece to king)
 * - back_rank / missed_mate: opponent threatens mate in 1
 */
import { Chess } from 'chess.js';
import fs from 'node:fs';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const FILES = 'abcdefgh';
const RANKS = '12345678';

function sq(file, rank) {
  return `${FILES[file]}${RANKS[rank]}`;
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

/** @type {import('./build-save-drills.mjs').Drill[]} */
const drills = [
  // Hanging
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
    solution: ['h4f6', 'h4f4', 'h4g5', 'h4g3', 'h4h5', 'h4h6', 'h4h3', 'h4e7', 'h4d8', 'h4e4'],
    note: 'Nf3 attacks your unprotected queen. Retreat before N×h4.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-q-05',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/3PP2q/5N2/PPP2PPP/RNBQKB1R b KQkq - 2 3',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'h4',
    prompt: 'Queen hanging again — pull her back.',
    solution: ['h4f6', 'h4f4', 'h4g5', 'h4g3', 'h4h5', 'h4h6', 'h4h3', 'h4e7', 'h4d8', 'h4e4'],
    note: 'Nf3 attacks Qh4. Save the queen.',
    expectedDropCp: 900,
  },
  {
    id: 'hang-r-01',
    fen: '4k3/8/8/8/8/8/4r3/4K3 b - - 0 1',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e2',
    prompt: 'Your rook is next to the enemy king — save it.',
    solution: ['e2e3', 'e2e4', 'e2e5', 'e2e6', 'e2e7', 'e2e8', 'e2a2', 'e2b2', 'e2c2', 'e2d2', 'e2f2', 'e2g2', 'e2h2', 'e2e1'],
    note: 'White’s king attacks the rook. Move it now.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-r-02',
    fen: '4k3/8/8/8/r7/8/8/R3K3 w - - 0 1',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'a1',
    prompt: 'Your rook is hanging on the a-file — save it.',
    solution: ['a1a2', 'a1a3', 'a1a4', 'a1a5', 'a1a6', 'a1a7', 'a1a8', 'a1b1', 'a1c1', 'a1d1'],
    note: 'Black’s rook attacks yours. Trade or step off a1.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-r-03',
    fen: 'r3k3/8/8/8/8/8/8/R3K3 w - - 0 1',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'a1',
    prompt: 'Rooks face off — yours is unprotected. Handle it.',
    solution: ['a1a8', 'a1a2', 'a1a3', 'a1a4', 'a1a5', 'a1a6', 'a1a7', 'a1b1', 'a1c1', 'a1d1'],
    note: 'Trade on a8 or move your rook so it isn’t hanging.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-r-04',
    fen: '4k3/8/8/r7/8/8/8/R3K3 w - - 0 1',
    sideToMove: 'w',
    theme: 'hanging',
    atRiskSquare: 'a1',
    prompt: 'Your rook is hanging — Black’s rook swings over next.',
    solution: ['a1a2', 'a1a3', 'a1a4', 'a1a5', 'a1a6', 'a1a7', 'a1a8', 'a1b1', 'a1c1', 'a1d1'],
    note: 'Black’s rook attacks a1 and yours is undefended. Trade or flee.',
    expectedDropCp: 500,
  },
  {
    id: 'hang-n-01',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/4n3/3P1N2/PPP2PPP/RNBQKB1R b KQkq - 0 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'e4',
    prompt: 'Your knight on e4 is hanging — save it.',
    solution: ['e4f6', 'e4c5', 'e4c3', 'e4d6', 'e4g5', 'e4g3', 'e4f2', 'e4d2', 'd7d5'],
    note: 'White threatens dxe4. The knight is hanging — retreat or support with d5.',
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
    fen: '4k3/8/2n5/8/8/8/8/2R1K3 b - - 0 1',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'c6',
    prompt: 'Your knight is hanging on the open file — save it.',
    solution: ['c6a5', 'c6a7', 'c6b4', 'c6b8', 'c6d4', 'c6d8', 'c6e5', 'c6e7', 'c6a5'],
    note: 'White’s rook attacks the unprotected knight. Move it before R×c6.',
    expectedDropCp: 300,
  },
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

  // Forks
  {
    id: 'fork-01',
    fen: '4k3/8/8/5n2/7R/4K3/8/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'h4',
    prompt: 'Knight forks your king and rook — save the rook (or step the king).',
    solution: ['h4h1', 'h4h2', 'h4h3', 'h4h5', 'h4h6', 'h4h7', 'h4h8', 'h4a4', 'h4b4', 'h4c4', 'h4d4', 'h4e4', 'h4f4', 'h4g4', 'e3d2', 'e3d3', 'e3d4', 'e3e2', 'e3e4', 'e3f2', 'e3f3', 'e3f4'],
    note: 'Nf5 forks king + rook. Move one of them off the fork.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-02',
    fen: '4k3/8/8/8/5n2/8/4K1R1/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'g2',
    prompt: 'You’re forked — get the rook out (or step the king).',
    solution: [
      'g2g1', 'g2g3', 'g2g4', 'g2g5', 'g2g6', 'g2g7', 'g2g8',
      'g2a2', 'g2b2', 'g2c2', 'g2d2', 'g2e2', 'g2f2', 'g2h2',
      'e2d1', 'e2d2', 'e2d3', 'e2e1', 'e2e3', 'e2f1', 'e2f2', 'e2f3',
    ],
    note: 'Nf4 forks king and rook. Step one of them off the fork squares.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-03',
    fen: '4k3/8/8/8/3n4/8/2Q1K3/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'c2',
    prompt: 'Knight forks king and queen — save the queen.',
    solution: ['c2c1', 'c2c3', 'c2c4', 'c2c5', 'c2c6', 'c2c7', 'c2c8', 'c2a2', 'c2b2', 'c2d2', 'c2b1', 'c2b3', 'c2d1', 'c2d3', 'c2a4', 'e2d1', 'e2d2', 'e2d3', 'e2e1', 'e2e3', 'e2f1', 'e2f2', 'e2f3'],
    note: 'Nd4 forks king + queen. Move the queen (or king) immediately.',
    expectedDropCp: 900,
  },
  {
    id: 'fork-04',
    fen: '4k3/8/8/8/3n4/5Q2/4K3/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'f3',
    prompt: 'Knight forks your king and queen — save the queen.',
    solution: [
      'f3f1', 'f3f2', 'f3f4', 'f3f5', 'f3f6', 'f3f7', 'f3f8',
      'f3a3', 'f3b3', 'f3c3', 'f3d3', 'f3e3', 'f3g3', 'f3h3',
      'f3a8', 'f3b7', 'f3c6', 'f3d5', 'f3e4', 'f3g4', 'f3h5',
      'f3g2', 'f3h1', 'f3e2', 'f3d1', 'f3c2', 'f3b1',
      'e2d1', 'e2d2', 'e2d3', 'e2e1', 'e2e3', 'e2f1', 'e2f2',
    ],
    note: 'Nd4 forks king and queen. Move the queen (or king) right now.',
    expectedDropCp: 900,
  },
  {
    id: 'fork-05',
    fen: '4k3/8/8/8/3n4/8/2R1K3/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'c2',
    prompt: 'Knight forks king and rook — save material.',
    solution: ['c2c1', 'c2c3', 'c2c4', 'c2c5', 'c2c6', 'c2c7', 'c2c8', 'c2a2', 'c2b2', 'c2d2', 'c2e2', 'c2f2', 'c2g2', 'c2h2', 'e2d1', 'e2d2', 'e2d3', 'e2e1', 'e2e3', 'e2f1', 'e2f2', 'e2f3'],
    note: 'Nd4 forks king + rook. Move the rook or the king.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-06',
    fen: '4k3/8/8/5n2/8/4K1R1/8/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'g3',
    prompt: 'Forked again — your rook and king are both hit.',
    solution: ['g3g1', 'g3g2', 'g3g4', 'g3g5', 'g3g6', 'g3g7', 'g3g8', 'g3a3', 'g3b3', 'g3c3', 'g3d3', 'g3e3', 'g3f3', 'g3h3', 'e3d2', 'e3d3', 'e3d4', 'e3e2', 'e3e4', 'e3f2', 'e3f3', 'e3f4'],
    note: 'Nf5 forks king + rook. Break the fork immediately.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-07',
    fen: '4k3/8/8/8/2n5/4K3/1R6/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'b2',
    prompt: 'Your rook is forked with the king — move one.',
    solution: ['b2b1', 'b2b3', 'b2b4', 'b2b5', 'b2b6', 'b2b7', 'b2b8', 'b2a2', 'b2c2', 'b2d2', 'b2e2', 'b2f2', 'b2g2', 'b2h2', 'e3d2', 'e3d3', 'e3d4', 'e3e2', 'e3e4', 'e3f2', 'e3f3', 'e3f4'],
    note: 'Nc4 forks king and rook. Save the rook or step the king.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-08',
    fen: '4k3/8/8/8/1n6/8/R1K5/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'a2',
    prompt: 'Knight forks king and rook — react.',
    solution: ['a2a1', 'a2a3', 'a2a4', 'a2a5', 'a2a6', 'a2a7', 'a2a8', 'a2b2', 'a2c2', 'a2d2', 'a2e2', 'a2f2', 'a2g2', 'a2h2', 'c2b1', 'c2b2', 'c2b3', 'c2c1', 'c2c3', 'c2d1', 'c2d2', 'c2d3'],
    note: 'Nb4 forks king + rook. Move one of them.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-09',
    fen: '4k3/8/8/8/3n4/5R2/4K3/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'fork',
    atRiskSquare: 'f3',
    prompt: 'Your rook is forked — save it.',
    solution: [
      'f3f1', 'f3f2', 'f3f4', 'f3f5', 'f3f6', 'f3f7', 'f3f8',
      'f3a3', 'f3b3', 'f3c3', 'f3d3', 'f3e3', 'f3g3', 'f3h3',
      'e2d1', 'e2d2', 'e2d3', 'e2e1', 'e2e3', 'e2f1', 'e2f2',
    ],
    note: 'Nd4 forks king and rook. Break the fork now.',
    expectedDropCp: 500,
  },
  {
    id: 'fork-10',
    fen: 'rnb1kb1r/ppp1pppp/5n2/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 3 4',
    sideToMove: 'b',
    theme: 'hanging',
    atRiskSquare: 'd5',
    prompt: 'Your queen is hanging under knight fire — relocate her.',
    solution: ['d5a5', 'd5d6', 'd5d7', 'd5d8', 'd5e6', 'd5f5', 'd5g5', 'd5h5', 'd5c6', 'd5c5', 'd5c4', 'd5b5', 'd5e4'],
    note: 'Nc3 attacks the unprotected queen. Move her before you drop her.',
    expectedDropCp: 800,
  },

  // Absolute pins
  {
    id: 'pin-01',
    fen: '4r1k1/8/8/8/8/4N3/4K3/8 w - - 0 1',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'e3',
    prompt: 'Your knight is pinned to the king — don’t move it blindly.',
    solution: ['e2d1', 'e2d2', 'e2d3', 'e2e1', 'e2f1', 'e2f2', 'e2f3'],
    note: 'The rook pins the knight. Step the king off the e-file first.',
    expectedDropCp: 200,
  },
  {
    id: 'pin-02',
    fen: '6k1/8/4n3/8/8/8/B6P/6K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'e6',
    prompt: 'Your knight is pinned to the king — unpin carefully.',
    solution: ['g8f8', 'g8h8', 'g8f7', 'g8g7', 'g8h7'],
    note: 'Ba2 pins the knight to the king on the long diagonal. Move the king off that line first.',
    expectedDropCp: 200,
  },
  {
    id: 'pin-03',
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
    id: 'pin-04',
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
    id: 'pin-05',
    fen: '5k2/8/5n2/8/8/8/8/5R1K b - - 0 1',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'f6',
    prompt: 'Absolute pin on the f-file — free your king line first.',
    solution: ['f8e7', 'f8e8', 'f8g7', 'f8g8'],
    note: 'The rook pins your knight to the king. Step the king off the file.',
    expectedDropCp: 200,
  },
  {
    id: 'pin-06',
    fen: '2k5/8/2n5/8/8/8/8/2R1K3 b - - 0 1',
    sideToMove: 'b',
    theme: 'pin',
    atRiskSquare: 'c6',
    prompt: 'Your knight is pinned on the c-file — unpin.',
    solution: ['c8b7', 'c8b8', 'c8d7', 'c8d8'],
    note: 'White’s rook pins the knight to your king. Move the king off the file.',
    expectedDropCp: 200,
  },
  {
    id: 'pin-07',
    fen: '4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'e2',
    prompt: 'Pinned knight on the e-file — step the king away.',
    solution: ['e1d1', 'e1d2', 'e1f1', 'e1f2'],
    note: 'Black’s rook pins your knight. Move the king off the file before touching the knight.',
    expectedDropCp: 200,
  },
  {
    id: 'pin-08',
    fen: '3r2k1/8/8/8/8/8/3N4/3K4 w - - 0 1',
    sideToMove: 'w',
    theme: 'pin',
    atRiskSquare: 'd2',
    prompt: 'Your knight is pinned to the king on the d-file.',
    solution: ['d1c1', 'd1c2', 'd1e1', 'd1e2'],
    note: 'The rook pins Nd2. Walk the king off the d-file.',
    expectedDropCp: 200,
  },

  // Mate-in-1 threats
  {
    id: 'back-01',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Back-rank mate is one move away — breathe.',
    solution: ['g7g6', 'h7h6', 'h7h5', 'f7f6', 'f7f5', 'g8f8', 'g8h8'],
    note: 'White threatens Re8#. Make luft or step the king.',
    expectedDropCp: 10000,
  },
  {
    id: 'back-02',
    fen: '6k1/3r1ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Your back rank is soft — White mates next if you ignore it.',
    solution: ['g7g6', 'h7h6', 'h7h5', 'd7d1', 'd7d8', 'd7e7', 'f7f6'],
    note: 'Re8# is threatened (your rook on d7 doesn’t cover e8). Make luft or get back.',
    expectedDropCp: 500,
  },
  {
    id: 'back-03',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Stop Ra8# — make luft now.',
    solution: ['g7g6', 'h7h6', 'h7h5', 'f7f6', 'f7f5', 'g8f8', 'g8h8'],
    note: 'White mates with Ra8 next. Create an escape square.',
    expectedDropCp: 10000,
  },
  {
    id: 'back-04',
    fen: '6k1/2r2ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'back_rank',
    atRiskSquare: 'g8',
    prompt: 'Back-rank mate is threatened — your c7-rook doesn’t cover e8.',
    solution: ['g7g6', 'h7h6', 'c7c1', 'c7c8', 'c7e7', 'f7f6'],
    note: 'Re8# is the threat. Make luft or rush a defender to the 8th.',
    expectedDropCp: 500,
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
    id: 'mate-03',
    fen: '6k1/5ppp/8/8/8/8/4QPPP/6K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'g8',
    prompt: 'Mate on e8 is coming — create an exit.',
    solution: ['g7g6', 'h7h6', 'f7f6', 'f7f5', 'g8f8', 'g8h8'],
    note: 'White threatens Qe8#. Make luft or step the king.',
    expectedDropCp: 10000,
  },
  {
    id: 'mate-04',
    fen: '6k1/5ppp/8/8/8/5Q2/5PPP/6K1 b - - 0 1',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'g8',
    prompt: 'Queen mates on a8 next — create an exit.',
    solution: ['g7g6', 'h7h6', 'f7f6', 'f7f5', 'g8f8', 'g8h8'],
    note: 'White threatens Qa8#. Make luft or step the king.',
    expectedDropCp: 10000,
  },
  {
    id: 'mate-05',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    theme: 'missed_mate',
    atRiskSquare: 'f7',
    prompt: 'Stop Qxf7# right now.',
    solution: ['g7g6', 'd8e7', 'g8f6'],
    note: 'Defend f7 immediately or it’s scholar’s mate.',
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
  console.error('Too few drills');
  process.exit(1);
}

fs.writeFileSync(
  new URL('../src/data/beginner-blunders.json', import.meta.url),
  `${JSON.stringify(kept, null, 2)}\n`,
);
console.log(`Wrote ${kept.length} immediate-danger drills`);
