import { Chess, type Square } from 'chess.js';

import { drillHref, type ThemeFilter } from '@/src/logic/drillLink';
import type { DrillPosition, DrillTheme } from '@/src/logic/drills';

export type LessonId =
  | 'blunder'
  | 'hanging'
  | 'fork'
  | 'pin'
  | 'back_rank'
  | 'mate'
  | 'counting'
  | 'overloaded'
  | 'discovered'
  | 'quiet_trap'
  | 'routine'
  | 'opening_traps'
  | 'counterplay'
  | 'endgame_safety';

export type BeatTone = 'setup' | 'blunder' | 'punishment' | 'ok';

export type LessonBeat = {
  text: string;
  /** UCI played to reach this beat. The first beat is the quiet position. */
  uci?: string;
  tone: BeatTone;
};

export type LessonArrow = { from: Square; to: Square };

export type LessonCard = {
  id: string;
  title: string;
  fen: string;
  sideToMove: 'w' | 'b';
  /** The card opens with this side already in check. */
  inCheck?: boolean;
  /** Shown on the opening beat, before any move. */
  arrows?: LessonArrow[];
  beats: LessonBeat[];
};

export type TryKind = 'even' | DrillTheme;

export type LessonTry = {
  coach: string;
  /** A move the judge rejects, so the try has a real miss. */
  blunder: string;
  kind: TryKind;
  drill: DrillPosition;
};

export type Lesson = {
  id: LessonId;
  title: string;
  summary: string;
  /** Drills filter opened by "Practice this in Drills". */
  practice: ThemeFilter;
  cards: LessonCard[];
  tries: LessonTry[];
};

export type ResolvedBeat = {
  text: string;
  tone: BeatTone;
  fen: string;
  san: string | null;
  lastMove: { from: Square; to: Square } | null;
  mate: boolean;
  captured: boolean;
};

const ORDER: readonly LessonId[] = ['blunder', 'hanging', 'fork', 'pin', 'back_rank', 'mate'];

export function resolveBeats(fen: string, beats: LessonBeat[]): ResolvedBeat[] {
  const game = new Chess(fen);
  const out: ResolvedBeat[] = [];
  for (const beat of beats) {
    if (!beat.uci) {
      if (out.length > 0) throw new Error(`setup beat after a move on ${fen}`);
      out.push({
        text: beat.text,
        tone: beat.tone,
        fen: game.fen(),
        san: null,
        lastMove: null,
        mate: false,
        captured: false,
      });
      continue;
    }
    const from = beat.uci.slice(0, 2) as Square;
    const to = beat.uci.slice(2, 4) as Square;
    let moved;
    try {
      moved = game.move({ from, to, promotion: 'q' });
    } catch {
      moved = null;
    }
    if (!moved) throw new Error(`illegal ${beat.uci} on ${fen}`);
    out.push({
      text: beat.text,
      tone: beat.tone,
      fen: game.fen(),
      san: moved.san,
      lastMove: { from: moved.from, to: moved.to },
      mate: game.isCheckmate(),
      captured: Boolean(moved.captured),
    });
  }
  return out;
}

function puzzle(input: {
  id: string;
  fen: string;
  side: 'w' | 'b';
  theme: DrillTheme;
  atRisk: Square;
  prompt: string;
  note: string;
  solution: string[];
  coach: string;
  blunder: string;
  kind: TryKind;
}): LessonTry {
  return {
    coach: input.coach,
    blunder: input.blunder,
    kind: input.kind,
    drill: {
      id: input.id,
      fen: input.fen,
      sideToMove: input.side,
      theme: input.theme,
      atRiskSquare: input.atRisk,
      prompt: input.prompt,
      solution: input.solution,
      acceptable: input.solution,
      traps: [],
      note: input.note,
      expectedDropCp: 300,
    },
  };
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'blunder',
    title: "What's a blunder?",
    summary: 'Losing a piece for nothing, or mate in one.',
    practice: 'all',
    cards: [
      {
        id: 'blunder-material',
        title: 'A free piece',
        fen: '4k3/8/5n2/8/8/8/3Q4/4K3 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'f6', to: 'd5' }],
        beats: [
          {
            tone: 'setup',
            text: 'The knight attacks d5. Your queen can step there, and nothing defends that square.',
          },
          { tone: 'blunder', uci: 'd2d5', text: 'She goes to d5.' },
          {
            tone: 'punishment',
            uci: 'f6d5',
            text: 'The knight takes her. You got nothing back. That is a blunder.',
          },
        ],
      },
      {
        id: 'blunder-trade',
        title: 'An even trade is fine',
        fen: '4k3/4q3/8/8/8/8/4Q3/4K3 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'e2', to: 'e7' }],
        beats: [
          { tone: 'setup', text: 'The queens attack each other.' },
          { tone: 'ok', uci: 'e2e7', text: 'You take their queen.' },
          {
            tone: 'ok',
            uci: 'e8e7',
            text: 'They take yours back. Both sides lost a queen. An even trade is not a blunder.',
          },
        ],
      },
      {
        id: 'blunder-mate',
        title: 'Mate in one counts',
        fen: 'rnbqkbnr/pppp1ppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
        sideToMove: 'w',
        arrows: [{ from: 'd8', to: 'h4' }],
        beats: [
          {
            tone: 'setup',
            text: 'The f-pawn has opened a diagonal toward your king. The black queen wants h4.',
          },
          { tone: 'blunder', uci: 'g2g4', text: 'g4 opens the rest of that diagonal.' },
          {
            tone: 'punishment',
            uci: 'd8h4',
            text: 'Queen to h4 is checkmate. Letting mate in one happen is a blunder too.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-blunder-hang',
        fen: '4k3/8/8/7q/8/8/8/4K2Q w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'h1',
        prompt: 'Your queen is hanging. Save her.',
        note: 'The queen on h5 attacks h1. Take her, or move your queen to a safe square.',
        solution: ['h1h5'],
        coach: 'Three ways to save a hanging piece: capture the attacker, move to safety, or defend it.',
        blunder: 'e1d2',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-blunder-trade',
        fen: '4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'e2',
        prompt: 'Take their rook.',
        note: 'Rxe7 trades rooks. That is even, so it is allowed.',
        solution: ['e2e7'],
        coach: 'Equal value for equal value is a fair trade — never a blunder.',
        blunder: 'e2e4',
        kind: 'even',
      }),
      puzzle({
        id: 'lesson-blunder-mate',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 2',
        side: 'w',
        theme: 'missed_mate',
        atRisk: 'e1',
        prompt: 'Stop the queen mate on h4.',
        note: 'h4 occupies the square the queen wants. Nh3 covers that square too.',
        solution: ['h2h4', 'g1h3'],
        coach: 'Find the square their queen wants to land on — block it or cover it.',
        blunder: 'b1c3',
        kind: 'missed_mate',
      }),
    ],
  },
  {
    id: 'hanging',
    title: 'Hanging pieces',
    summary: 'A piece with an attacker and no defender.',
    practice: 'hanging',
    cards: [
      {
        id: 'hanging-queen',
        title: 'Nothing defends her',
        fen: 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
        sideToMove: 'w',
        arrows: [{ from: 'f6', to: 'h5' }],
        beats: [
          {
            tone: 'setup',
            text: 'Ask: is anything of mine hanging? The knight on f6 attacks the queen. No white piece defends h5.',
          },
          { tone: 'blunder', uci: 'b1c3', text: 'Nc3 develops a knight and leaves the queen there.' },
          {
            tone: 'punishment',
            uci: 'f6h5',
            text: 'The knight takes the queen for free. Move her, defend her, or take the attacker.',
          },
        ],
      },
      {
        id: 'hanging-rook',
        title: 'Check the whole board',
        fen: '4k3/8/8/8/8/8/1b6/R3K3 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'b2', to: 'a1' }],
        beats: [
          {
            tone: 'setup',
            text: 'The bishop attacks your rook. Your king does not defend it. The rook is hanging.',
          },
          { tone: 'blunder', uci: 'e1e2', text: 'The king steps away. The rook is still loose.' },
          { tone: 'punishment', uci: 'b2a1', text: 'The bishop takes the rook. Look once before every move.' },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-hang-queen',
        fen: 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
        side: 'w',
        theme: 'hanging',
        atRisk: 'h5',
        prompt: 'Your queen is hanging. Get her safe.',
        note: 'Nf6 attacks h5. Qe2 steps off the knight.',
        solution: ['h5e2'],
        coach: 'Scan safe squares for your queen — make sure the new square is not attacked either.',
        blunder: 'b1c3',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-hang-rook',
        fen: '4k3/8/8/8/8/8/1b6/R3K3 w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'a1',
        prompt: 'Your rook is hanging. Move it.',
        note: 'The bishop attacks a1. Ra2 steps off that diagonal.',
        solution: ['a1a2'],
        coach: 'Bishops hit long diagonals from far away. Step the rook off that diagonal.',
        blunder: 'e1e2',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-hang-bishop',
        fen: '4k3/8/8/6q1/8/8/8/4K1B1 w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'g1',
        prompt: 'Your bishop is hanging. Save it.',
        note: 'The queen attacks g1. Bf2 steps the bishop away.',
        solution: ['g1f2'],
        coach: 'Look at the line the enemy queen controls — move the bishop out of her sights or guard it.',
        blunder: 'e1e2',
        kind: 'hanging',
      }),
    ],
  },
  {
    id: 'fork',
    title: 'Forks',
    summary: 'One piece attacks two of yours. Knights first.',
    practice: 'fork',
    cards: [
      {
        id: 'fork-quiet',
        title: 'One knight, two targets',
        fen: '4k3/8/8/8/8/8/5n2/3QK2R w - - 0 1',
        sideToMove: 'w',
        arrows: [
          { from: 'f2', to: 'd1' },
          { from: 'f2', to: 'h1' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'This knight attacks your queen and your rook at the same time. That is a fork. Look for knights first.',
          },
          { tone: 'blunder', uci: 'd1d2', text: 'The queen steps off. The rook is still attacked.' },
          { tone: 'punishment', uci: 'f2h1', text: 'The knight takes the rook. Both pieces needed a save.' },
        ],
      },
      {
        id: 'fork-check',
        title: 'The king is one of the targets',
        fen: '4k3/8/8/8/8/8/2n5/R2QK3 w - - 0 1',
        sideToMove: 'w',
        inCheck: true,
        arrows: [
          { from: 'c2', to: 'e1' },
          { from: 'c2', to: 'a1' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'The knight checks your king and attacks the rook. A check comes first, and the other piece still matters.',
          },
          { tone: 'blunder', uci: 'e1e2', text: 'The king steps out of check and leaves the rook.' },
          {
            tone: 'punishment',
            uci: 'c2a1',
            text: 'The knight takes the rook. You can win the knight back, and you are still down a rook for a knight.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-fork-king',
        fen: '4k3/8/8/8/8/8/5n2/3QK2R w - - 0 1',
        side: 'w',
        theme: 'fork',
        atRisk: 'd1',
        prompt: 'A knight forks your queen and rook. Take it.',
        note: 'Kxf2 captures the knight, so both pieces are safe.',
        solution: ['e1f2'],
        coach: 'Moving just one forked piece drops the other. Check if any piece — even your king — can capture the attacker.',
        blunder: 'd1d2',
        kind: 'fork',
      }),
      puzzle({
        id: 'lesson-fork-check',
        fen: '4k3/8/8/8/8/8/2n5/R2QK3 w - - 0 1',
        side: 'w',
        theme: 'fork',
        atRisk: 'a1',
        prompt: 'The knight checks you and attacks your rook.',
        note: 'Qxc2 takes the knight and gets you out of check.',
        solution: ['d1c2'],
        coach: 'Before running with the king, check if you can capture the checking piece.',
        blunder: 'e1e2',
        kind: 'fork',
      }),
      puzzle({
        id: 'lesson-fork-pawn',
        fen: '4k3/8/8/8/4n3/3P2R1/3Q4/4K3 w - - 0 1',
        side: 'w',
        theme: 'fork',
        atRisk: 'd2',
        prompt: 'A knight forks your queen and rook.',
        note: 'dxe4 takes the knight with the pawn.',
        solution: ['d3e4'],
        coach: 'Always check your pawns — a humble pawn capture often breaks a fork immediately.',
        blunder: 'd2d1',
        kind: 'fork',
      }),
    ],
  },
  {
    id: 'pin',
    title: 'Pins',
    summary: 'A piece stuck in front of something more valuable.',
    practice: 'pin',
    cards: [
      {
        id: 'pin-bishop',
        title: 'Stuck in front of the king',
        fen: '4k3/8/8/b7/8/2N5/8/4K3 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'a5', to: 'e1' }],
        beats: [
          {
            tone: 'setup',
            text: 'The bishop pins your knight to the king. The knight cannot step off that line. Moving it would put your king in check.',
          },
          { tone: 'blunder', uci: 'e1d1', text: 'The king steps to d1 and leaves the knight loose.' },
          { tone: 'punishment', uci: 'a5c3', text: 'The bishop takes the knight. A pin means that piece is stuck.' },
        ],
      },
      {
        id: 'pin-rook',
        title: 'Same idea, on a file',
        fen: '4k3/8/4n3/8/8/8/8/4R1K1 b - - 0 1',
        sideToMove: 'b',
        arrows: [{ from: 'e1', to: 'e8' }],
        beats: [
          {
            tone: 'setup',
            text: 'The rook pins your knight to the king. The knight has to stay on the file.',
          },
          { tone: 'blunder', uci: 'e8d8', text: 'The king steps to d8. The knight is no longer defended.' },
          { tone: 'punishment', uci: 'e1e6', text: 'The rook takes the knight. Keep a pinned piece safe.' },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-pin-take',
        fen: '4k3/8/8/b7/8/2N5/Q7/4K3 w - - 0 1',
        side: 'w',
        theme: 'pin',
        atRisk: 'c3',
        prompt: 'Your knight is pinned. Take the bishop.',
        note: 'Qxa5 captures the bishop that pins the knight.',
        solution: ['a2a5'],
        coach: 'A pinned piece cannot move itself — use another piece to capture the attacker or break the line.',
        blunder: 'e1d1',
        kind: 'pin',
      }),
      puzzle({
        id: 'lesson-pin-file',
        fen: '4k3/8/4n3/8/8/8/8/4R1K1 b - - 0 1',
        side: 'b',
        theme: 'pin',
        atRisk: 'e6',
        prompt: 'Your knight is pinned. Keep it safe.',
        note: 'Kd7 steps aside and still defends the knight.',
        solution: ['e8d7'],
        coach: 'When unpinning with your king, step to a square that still stays right next to the pinned piece.',
        blunder: 'e8d8',
        kind: 'pin',
      }),
    ],
  },
  {
    id: 'back_rank',
    title: 'Back rank',
    summary: 'A king trapped by its own pawns.',
    practice: 'back_rank',
    cards: [
      {
        id: 'back-mate',
        title: 'No air for the king',
        fen: '1r4k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'b8', to: 'b1' }],
        beats: [
          {
            tone: 'setup',
            text: 'Your king is stuck behind the pawns on f2, g2, and h2. The rook on a1 is the only piece covering b1.',
          },
          { tone: 'blunder', uci: 'a1a2', text: 'The rook steps off the first rank.' },
          {
            tone: 'punishment',
            uci: 'b8b1',
            text: 'The black rook lands on b1 and it is mate. The king had no square to run to.',
          },
        ],
      },
      {
        id: 'back-luft',
        title: 'Give the king a square',
        fen: '1r4k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'b8', to: 'b1' }],
        beats: [
          {
            tone: 'setup',
            text: 'A pawn move can open one square. That air is called luft.',
          },
          { tone: 'ok', uci: 'h2h3', text: 'h3 lets the king use h2.' },
          { tone: 'ok', uci: 'b8b1', text: 'The rook checks on b1. It is not mate.' },
          { tone: 'ok', uci: 'g1h2', text: 'The king steps to h2. One free square was enough.' },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-back-luft',
        fen: '1r4k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        side: 'w',
        theme: 'back_rank',
        atRisk: 'g1',
        prompt: 'Stop mate on b1.',
        note: 'h3 gives the king h2. Keeping a rook on the first rank also covers b1.',
        solution: ['h2h3'],
        coach: 'Give your king a safe escape square ("luft") or keep a defender on the first rank.',
        blunder: 'a1a2',
        kind: 'back_rank',
      }),
      puzzle({
        id: 'lesson-back-file',
        fen: '2r3k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1',
        side: 'w',
        theme: 'back_rank',
        atRisk: 'g1',
        prompt: 'Stop mate on c1.',
        note: 'h3 gives the king air. Do not step the rook off the first rank.',
        solution: ['h2h3'],
        coach: 'Push one pawn in front of your king — or keep your rook guarding the first rank.',
        blunder: 'b1b2',
        kind: 'back_rank',
      }),
    ],
  },
  {
    id: 'mate',
    title: 'Mate in 1',
    summary: 'Check every check your opponent has.',
    practice: 'missed_mate',
    cards: [
      {
        id: 'mate-fool',
        title: 'Look at their checks',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 2',
        sideToMove: 'w',
        arrows: [{ from: 'd8', to: 'h4' }],
        beats: [
          {
            tone: 'setup',
            text: 'Before you move, ask what check they have. The queen can reach h4 along the diagonal your pawns opened.',
          },
          { tone: 'blunder', uci: 'b1c3', text: 'Nc3 develops a piece and does not stop that check.' },
          { tone: 'punishment', uci: 'd8h4', text: 'Queen to h4 is mate. A longer mate is not the task. This one is.' },
        ],
      },
      {
        id: 'mate-scholar',
        title: 'The check on f7',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        sideToMove: 'b',
        arrows: [
          { from: 'h5', to: 'f7' },
          { from: 'c4', to: 'f7' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'The queen on h5 and the bishop on c4 both look at f7. That is a mate in one if you ignore it.',
          },
          { tone: 'blunder', uci: 'a7a6', text: 'a6 does not answer the check they have.' },
          { tone: 'punishment', uci: 'h5f7', text: 'Queen takes f7 and it is mate. Check every check, then move.' },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-mate-h4',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 2',
        side: 'w',
        theme: 'missed_mate',
        atRisk: 'e1',
        prompt: 'Stop the queen mate on h4.',
        note: 'h4 occupies the square the queen wants. Nh3 covers the idea too.',
        solution: ['h2h4', 'g1h3'],
        coach: 'Ask: how can I block, occupy, or guard the square they want to mate on?',
        blunder: 'b1c3',
        kind: 'missed_mate',
      }),
      puzzle({
        id: 'lesson-mate-f7',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        side: 'b',
        theme: 'missed_mate',
        atRisk: 'f7',
        prompt: 'Stop mate on f7.',
        note: 'Nxh5 takes the queen and stops the mate.',
        solution: ['f6h5', 'd8e7'],
        coach: 'Look for a capture on the mating piece first — or add a defender to f7.',
        blunder: 'a7a6',
        kind: 'missed_mate',
      }),
      puzzle({
        id: 'lesson-mate-d8',
        fen: 'rnb3k1/pp3ppp/2p5/4p3/4P3/5N2/PP3PPP/RNBQ1RK1 b - - 0 8',
        side: 'b',
        theme: 'missed_mate',
        atRisk: 'g8',
        prompt: 'Stop the queen mate on d8.',
        note: 'Nd7 blocks the file. f6 also stops Qd8#.',
        solution: ['b8d7', 'f7f6'],
        coach: 'Block the open d-file, cover d8, or give your king an escape square.',
        blunder: 'b8a6',
        kind: 'missed_mate',
      }),
    ],
  },
];

export const CLUB_LESSONS: readonly Lesson[] = [
  {
    id: 'counting',
    title: 'Counting defenders',
    summary: 'Two attackers beat one defender, and value beats count.',
    practice: 'hanging',
    cards: [
      {
        id: 'counting-two-on-one',
        title: 'Two attackers, one defender',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b5/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 1 6',
        sideToMove: 'w',
        arrows: [
          { from: 'c6', to: 'd4' },
          { from: 'c5', to: 'd4' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'Your queen defends d4, so the knight feels safe. Count again: both the c6 knight and the c5 bishop attack d4.',
          },
          { tone: 'blunder', uci: 'f1b5', text: 'Bb5 develops and leaves d4 outgunned two to one.' },
          {
            tone: 'punishment',
            uci: 'c6d4',
            text: 'Black wins the knight. If you recapture with the queen, the bishop takes her. Always count attackers and defenders.',
          },
        ],
      },
      {
        id: 'counting-value',
        title: 'Value beats count',
        fen: '6k1/5ppp/8/1b6/8/8/P3RPPP/4K3 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'b5', to: 'e2' }],
        beats: [
          {
            tone: 'setup',
            text: 'Count is one attacker versus one defender, since your king defends e2. Value still matters: a bishop attacking a rook wins the exchange.',
          },
          { tone: 'blunder', uci: 'a2a3', text: 'a3 ignores the bishop on the diagonal.' },
          {
            tone: 'punishment',
            uci: 'b5e2',
            text: 'Bxe2 wins a rook for a bishop. Defending a pricier piece is not enough when a cheaper piece attacks it.',
          },
        ],
      },
    ],
    tries: [
      {
        ...puzzle({
          id: 'lesson-count-d4',
          fen: 'r1bqk2r/pppp1ppp/2n2n2/2b5/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 1 6',
          side: 'w',
          theme: 'hanging',
          atRisk: 'd4',
          prompt: 'd4 is attacked twice and defended once. Fix the count.',
          note: 'Be3 adds a second defender. Nxc6 removes an attacker, and Nf3 steps away safely.',
          solution: ['c1e3', 'd4c6', 'd4f3'],
          coach: 'Two pieces attack d4 and only your queen defends it. Defend it again, trade, or move it.',
          blunder: 'f1b5',
          kind: 'hanging',
        }),
      },
      {
        ...puzzle({
          id: 'lesson-count-exchange',
          fen: '6k1/5ppp/8/1b6/8/8/P3RPPP/4K3 w - - 0 1',
          side: 'w',
          theme: 'hanging',
          atRisk: 'e2',
          prompt: 'A bishop attacks your rook. Save the exchange.',
          note: 'Your king defends e2, but losing a rook for a bishop drops two points. Move the rook off the diagonal.',
          solution: ['e2e5', 'e2b2'],
          coach: 'A cheaper piece attacks your rook. Move the rook to a safe square.',
          blunder: 'a2a3',
          kind: 'hanging',
        }),
      },
    ],
  },
  {
    id: 'overloaded',
    title: 'Overloaded pieces',
    summary: 'One defender cannot guard two threats at once.',
    practice: 'fork',
    cards: [
      {
        id: 'overload-backrank',
        title: 'Leaving your post',
        fen: '4r1k1/5ppp/8/3b4/8/8/5PPP/3R2K1 w - - 0 1',
        sideToMove: 'w',
        arrows: [
          { from: 'd1', to: 'e1' },
          { from: 'e8', to: 'e1' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'The bishop on d5 looks completely free. Before you grab it, ask what your rook on d1 is guarding: the back rank.',
          },
          { tone: 'blunder', uci: 'd1d5', text: 'Rxd5 takes the bishop and leaves e1 unguarded.' },
          {
            tone: 'punishment',
            uci: 'e8e1',
            text: 'Re1 is checkmate. Never move a sole defender off its job without checking the threat it holds back.',
          },
        ],
      },
      {
        id: 'overload-queen',
        title: 'Tied down to a teammate',
        fen: '2r3k1/5p1p/6p1/4p3/8/8/2R1QPPP/6K1 w - - 0 1',
        sideToMove: 'w',
        arrows: [
          { from: 'e2', to: 'c2' },
          { from: 'c8', to: 'c2' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'Your queen on e2 is the only defender of the rook on c2. The pawn on e5 is bait.',
          },
          { tone: 'blunder', uci: 'e2e5', text: 'Qxe5 grabs the pawn and pulls the queen off the second rank.' },
          {
            tone: 'punishment',
            uci: 'c8c2',
            text: 'Rxc2 wins a full rook. Check what a piece defends before using it to capture.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-overload-queen',
        fen: '2r3k1/5p1p/6p1/8/6b1/8/2R1QPPP/6K1 w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'e2',
        prompt: 'The bishop attacks your queen, and she guards c2. Keep both safe.',
        note: 'Qd2 or Qd3 saves the queen while still defending c2. f3 blocks the diagonal and attacks the bishop.',
        solution: ['e2d2', 'e2d3', 'f2f3'],
        coach: 'Save the queen without dropping the rook on c2.',
        blunder: 'e2e3',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-overload-backrank',
        fen: '4r1k1/5ppp/8/8/6b1/8/5PPP/3R2K1 w - - 0 1',
        side: 'w',
        theme: 'back_rank',
        atRisk: 'd1',
        prompt: 'The bishop attacks your rook, and it guards e1.',
        note: 'Slide the rook along the first rank — Rf1, Rc1, or Rb1 saves the rook and still prevents Re1#.',
        solution: ['d1f1', 'd1c1', 'd1b1'],
        coach: 'Save the rook without leaving the back rank open to mate.',
        blunder: 'd1d2',
        kind: 'back_rank',
      }),
    ],
  },
  {
    id: 'discovered',
    title: 'Discovered threats',
    summary: 'Moving a shield uncovers the slider hiding behind it.',
    practice: 'pin',
    cards: [
      {
        id: 'discovered-diag',
        title: 'The sniper on the long diagonal',
        fen: '6k1/5pbp/6p1/8/3N4/1P6/P4PPP/R5K1 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'g7', to: 'a1' }],
        beats: [
          {
            tone: 'setup',
            text: 'Black’s bishop on g7 aims all the way to your rook on a1. Your knight on d4 is the only shield on that diagonal.',
          },
          { tone: 'blunder', uci: 'd4f3', text: 'Nf3 steps off the diagonal.' },
          {
            tone: 'punishment',
            uci: 'g7a1',
            text: 'Bxa1 takes the rook across the entire board. Scan behind any piece before you move it.',
          },
        ],
      },
      {
        id: 'discovered-file',
        title: 'Opening a file onto your queen',
        fen: '4r1k1/1p3ppp/8/8/4B3/8/4QPPP/6K1 w - - 0 1',
        sideToMove: 'w',
        arrows: [{ from: 'e8', to: 'e2' }],
        beats: [
          {
            tone: 'setup',
            text: 'Black’s rook on e8 X-rays your queen on e2 through your bishop on e4. The b7 pawn looks tempting.',
          },
          { tone: 'blunder', uci: 'e4b7', text: 'Bxb7 steps off the e-file to grab a pawn.' },
          {
            tone: 'punishment',
            uci: 'e8e2',
            text: 'Rxe2 wins your queen. Never uncover a rook or queen lined up against a bigger piece.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-disc-diag',
        fen: '6k1/5pbp/6p1/8/3N4/1P6/P1P2PPP/R5K1 w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'd4',
        prompt: 'The bishop attacks d4 and X-rays a1 behind it.',
        note: 'c3 defends the knight and blocks the diagonal. Rd1 saves the rook and defends d4 at the same time.',
        solution: ['c2c3', 'a1d1'],
        coach: 'Moving the knight uncovers your rook on a1. Keep both safe.',
        blunder: 'd4f3',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-disc-file',
        fen: '4r1k1/5ppp/5n2/8/4B3/8/4QPPP/6K1 w - - 0 1',
        side: 'w',
        theme: 'hanging',
        atRisk: 'e4',
        prompt: 'e4 is attacked twice, and your bishop shields your queen.',
        note: 'f3 adds a second defender so the bishop can stay right on e4 blocking the e-file.',
        solution: ['f2f3'],
        coach: 'Do not move the bishop off the e-file. Add a defender to e4.',
        blunder: 'e4f5',
        kind: 'hanging',
      }),
    ],
  },
  {
    id: 'quiet_trap',
    title: 'Quiet blunders',
    summary: 'Normal developing moves that cut off or abandon a defender.',
    practice: 'all',
    cards: [
      {
        id: 'quiet-interfere',
        title: 'Blocking your own defender',
        fen: 'rnb1kbnr/pp1p1ppp/1q2p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5',
        sideToMove: 'w',
        arrows: [
          { from: 'd1', to: 'd4' },
          { from: 'b6', to: 'd4' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'Black’s queen attacks your knight on d4, and your queen on d1 defends it along the d-file.',
          },
          { tone: 'blunder', uci: 'c1d2', text: 'Bd2 looks like natural development, but it steps between your queen and knight.' },
          {
            tone: 'punishment',
            uci: 'b6d4',
            text: 'Qxd4 wins a free knight. Check that a developing move does not block your own defense.',
          },
        ],
      },
      {
        id: 'quiet-castle',
        title: 'Castling off a loose piece',
        fen: '4r1k1/ppp2ppp/2n5/8/8/5N2/PPP1BPPP/R3K2R w KQ - 0 12',
        sideToMove: 'w',
        arrows: [
          { from: 'e1', to: 'e2' },
          { from: 'e8', to: 'e2' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'Castling feels automatically safe. Here your king on e1 is the only piece defending the bishop on e2.',
          },
          { tone: 'blunder', uci: 'e1g1', text: 'O-O moves the king away and leaves the bishop undefended.' },
          {
            tone: 'punishment',
            uci: 'e8e2',
            text: 'Rxe2 wins the bishop for free. Even castling deserves a one-second blunder check.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-quiet-interfere',
        fen: 'r1b1kbnr/pp1ppppp/1qn5/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5',
        side: 'w',
        theme: 'hanging',
        atRisk: 'd4',
        prompt: 'd4 is attacked twice. Do not block your own queen.',
        note: 'Nb3 steps to safety, Nxc6 trades an attacker, and c3 adds a defender. Bd2 would cut off Qd1.',
        solution: ['d4b3', 'd4c6', 'c2c3'],
        coach: 'Save d4 without cutting off your queen’s line.',
        blunder: 'c1d2',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-quiet-castle',
        fen: '4r1k1/ppp2ppp/8/8/6b1/8/PPP1BPPP/R3K2R w KQ - 0 12',
        side: 'w',
        theme: 'hanging',
        atRisk: 'e2',
        prompt: 'Your bishop on e2 is under pressure. Do not blindly castle.',
        note: 'f3 blocks the bishop diagonal and drives Bg4 back while your king stays defending e2.',
        solution: ['f2f3'],
        coach: 'Castling drops e2 right away. Block the second attacker instead.',
        blunder: 'e1g1',
        kind: 'hanging',
      }),
    ],
  },
];

export const HABIT_LESSONS: readonly Lesson[] = [
  {
    id: 'routine',
    title: 'The 4-step blunder check',
    summary: 'Check their last move, loose pieces, forcing replies, and your move’s fallout.',
    practice: 'all',
    cards: [
      {
        id: 'routine-last-move',
        title: '1. Read their last move',
        fen: 'rnb1kb1r/ppppqppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 1 4',
        sideToMove: 'w',
        arrows: [{ from: 'e7', to: 'e5' }],
        beats: [
          {
            tone: 'setup',
            text: 'Black just played Qe7. Step 1: ask what their last move changed — the queen now attacks your undefended knight on e5.',
          },
          { tone: 'blunder', uci: 'f1c4', text: 'Bc4 develops on autopilot and ignores Black’s last move.' },
          {
            tone: 'punishment',
            uci: 'e7e5',
            text: 'Qxe5 wins the knight for nothing. Always ask what your opponent’s last move threatens first.',
          },
        ],
      },
      {
        id: 'routine-forcing',
        title: '2 & 3. Loose pieces and forcing moves',
        fen: 'r1b2rk1/ppp2ppp/2np4/4N3/4P1nq/2N5/PPP2PPP/R1BQ1RK1 w - - 0 10',
        sideToMove: 'w',
        arrows: [
          { from: 'h4', to: 'h2' },
          { from: 'g4', to: 'h2' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'Before grabbing material, run Step 3: checks, captures, threats. Black’s queen and knight both aim at h2.',
          },
          { tone: 'blunder', uci: 'e5c6', text: 'Nxc6 grabs a knight without checking if Black has a checkmate.' },
          {
            tone: 'punishment',
            uci: 'h4h2',
            text: 'Qxh2# is checkmate. Scan their forcing moves first, especially checks.',
          },
        ],
      },
      {
        id: 'routine-verify',
        title: '4. Verify before you let go',
        fen: 'r1b2rk1/ppp2ppp/2np4/4N3/4P1nq/2N5/PPP2PPP/R1BQ1RK1 w - - 0 10',
        sideToMove: 'w',
        arrows: [{ from: 'e5', to: 'g4' }],
        beats: [
          {
            tone: 'setup',
            text: 'Same board — now run Step 4 before moving. Compare a defensive candidate: Nxg4 removes the mate helper.',
          },
          { tone: 'ok', uci: 'e5g4', text: 'Nxg4 trades off the knight supporting h2.' },
          {
            tone: 'ok',
            uci: 'c8g4',
            text: 'Black recaptures with Bxg4. It is an even trade, and the mate threat is gone.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-routine-last-move',
        fen: 'rnb1kb1r/ppp2ppp/5n2/3qN3/8/8/PPPP1PPP/RNBQKB1R w KQkq - 0 5',
        side: 'w',
        theme: 'hanging',
        atRisk: 'e5',
        prompt: 'Black just played Qxd5. Save your loose knight.',
        note: 'Qxd5 attacks e5 along the fifth rank. Nf3, d4, or Qe2 keeps you from dropping the knight.',
        solution: ['e5f3', 'd2d4', 'd1e2'],
        coach: 'Step 1: check what their queen on d5 hits. Your knight on e5 has no defender.',
        blunder: 'f1c4',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-routine-verify',
        fen: 'r1b2rk1/ppp2ppp/2np4/4N3/4P1nq/2N5/PPP2PPP/R1BQ1RK1 w - - 0 10',
        side: 'w',
        theme: 'missed_mate',
        atRisk: 'g1',
        prompt: 'Run your 4-step check. Stop mate on h2.',
        note: 'Nxg4 trades off the knight supporting h2, and Nf3 retreats to guard h2 while attacking the queen.',
        solution: ['e5g4', 'e5f3'],
        coach: 'Ignore c6 for a moment — check Black’s forcing mate threat on h2 first.',
        blunder: 'e5c6',
        kind: 'missed_mate',
      }),
    ],
  },
  {
    id: 'opening_traps',
    title: 'Opening traps & greed',
    summary: 'Early pawn grabs, center pins, and stopping autopilot when they deviate.',
    practice: 'hanging',
    cards: [
      {
        id: 'opening-greed',
        title: 'The poisoned pawn grab',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        sideToMove: 'w',
        arrows: [{ from: 'c6', to: 'e5' }],
        beats: [
          {
            tone: 'setup',
            text: 'The e5 pawn looks tempting in the opening, but Black’s knight on c6 guards it.',
          },
          { tone: 'blunder', uci: 'f3e5', text: 'Nxe5 grabs the pawn without counting who defends e5.' },
          {
            tone: 'punishment',
            uci: 'c6e5',
            text: 'Nxe5 wins your knight for a pawn. Never grab an early pawn before checking its defenders.',
          },
        ],
      },
      {
        id: 'opening-deviate',
        title: 'When they break your script',
        fen: 'rnb1kb1r/pp2pppp/2p2n2/q5B1/2pP4/2N1P3/PP3PPP/R2QKBNR w KQkq - 1 6',
        sideToMove: 'w',
        arrows: [{ from: 'a5', to: 'g5' }],
        beats: [
          {
            tone: 'setup',
            text: 'Black broke the script with Qa5. Your bishop on g5 is undefended across the open fifth rank.',
          },
          {
            tone: 'blunder',
            uci: 'f1c4',
            text: 'Bxc4 wins the pawn back on autopilot while forgetting g5.',
          },
          {
            tone: 'punishment',
            uci: 'a5g5',
            text: 'Qxg5 takes the bishop for free. Pause your opening plan whenever the opponent deviates.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-opening-deviate',
        fen: 'rnb1kb1r/pp2pppp/2p2n2/q5B1/2pP4/2N1P3/PP3PPP/R2QKBNR w KQkq - 1 6',
        side: 'w',
        theme: 'hanging',
        atRisk: 'g5',
        prompt: 'Black deviated with Qa5. Save your bishop on g5.',
        note: 'Bxf6 trades the bishop cleanly, Nf3 develops while defending g5, and Bh4 retreats to safety.',
        solution: ['g5f6', 'g1f3', 'g5h4'],
        coach: 'Do not rush to recapture on c4 — Black’s queen attacks g5 across the fifth rank.',
        blunder: 'f1c4',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-opening-pin',
        fen: 'rnbqkb1r/ppp2ppp/3p4/8/4n3/5N2/PPPPQPPP/RNB1KB1R b KQkq - 1 5',
        side: 'b',
        theme: 'pin',
        atRisk: 'e4',
        prompt: 'Your king is still in the center and e4 is pinned. Defend it.',
        note: 'Qe7, d5, or f5 defends the pinned knight on e4 so Qxe4+ does not win a free piece.',
        solution: ['d8e7', 'd6d5', 'f7f5'],
        coach: 'Your knight on e4 cannot move off the e-file while your king sits on e8. Guard it right away.',
        blunder: 'b8c6',
        kind: 'pin',
      }),
    ],
  },
  {
    id: 'counterplay',
    title: 'Tunnel vision & counterplay',
    summary: 'Watch their threats while attacking, and never play recaptures on autopilot.',
    practice: 'fork',
    cards: [
      {
        id: 'counterplay-tunnel',
        title: 'Falling in love with your attack',
        fen: 'r1r3k1/p4ppp/4p3/q2p4/6Q1/2N5/P4PPP/R3R1K1 w - - 0 16',
        sideToMove: 'w',
        arrows: [{ from: 'a5', to: 'c3' }],
        beats: [
          {
            tone: 'setup',
            text: 'You want to swing Re3 and Rg3 at Black’s king. Stop and check their counterplay: the queen on a5 attacks your loose knight on c3.',
          },
          { tone: 'blunder', uci: 'e1e3', text: 'Re3 chases your own attack with tunnel vision.' },
          {
            tone: 'punishment',
            uci: 'a5c3',
            text: 'Qxc3 takes the knight for free and hits your rooks. Check their threats before pushing your attack.',
          },
        ],
      },
      {
        id: 'counterplay-recapture',
        title: 'No automatic recaptures',
        fen: '4r1k1/5ppp/8/8/3b4/1N6/PP3PPP/3Q2K1 w - - 0 25',
        sideToMove: 'w',
        arrows: [
          { from: 'e8', to: 'e1' },
          { from: 'd1', to: 'e1' },
        ],
        beats: [
          {
            tone: 'setup',
            text: 'Black just captured on d4. Both your queen and your knight can take back — do not recapture on reflex.',
          },
          { tone: 'blunder', uci: 'd1d4', text: 'Qxd4 recaptures automatically and leaves the first rank unguarded.' },
          {
            tone: 'punishment',
            uci: 'e8e1',
            text: 'Re1# is checkmate. Even an obvious recapture deserves a one-second blunder check.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-counterplay-recapture',
        fen: '4r1k1/5ppp/8/8/3n4/1N6/PP3PPP/3Q2K1 w - - 0 25',
        side: 'w',
        theme: 'back_rank',
        atRisk: 'g1',
        prompt: 'Recapture on d4 without allowing back-rank mate.',
        note: 'Nxd4 takes the knight while your queen keeps guarding e1. Qxd4 walks straight into Re1#.',
        solution: ['b3d4'],
        coach: 'Pause before recapturing with your queen — check what she is guarding on the first rank.',
        blunder: 'd1d4',
        kind: 'back_rank',
      }),
      puzzle({
        id: 'lesson-counterplay-tunnel',
        fen: 'r1r3k1/p4ppp/4p3/q2p4/6Q1/2N5/P4PPP/R3R1K1 w - - 0 16',
        side: 'w',
        theme: 'hanging',
        atRisk: 'c3',
        prompt: 'Pause the kingside attack. Keep your knight on c3 safe.',
        note: 'Both Qa5 and Rc8 attack c3. Ne2 gets your knight safely out of the line of fire while keeping your back rank guarded.',
        solution: ['c3e2'],
        coach: 'Two pieces — Qa5 and Rc8 — target c3. Move the knight out of danger before attacking.',
        blunder: 'e1e3',
        kind: 'hanging',
      }),
    ],
  },
  {
    id: 'endgame_safety',
    title: 'Endgame traps & loose pawns',
    summary: 'Fewer pieces raise the stakes — watch loose pawns and back-rank traps.',
    practice: 'back_rank',
    cards: [
      {
        id: 'endgame-loose-pawn',
        title: 'Relaxing in a simple endgame',
        fen: '8/5pk1/6p1/P2r3p/8/5P2/4R1PP/6K1 w - - 0 38',
        sideToMove: 'w',
        arrows: [{ from: 'd5', to: 'a5' }],
        beats: [
          {
            tone: 'setup',
            text: 'The endgame looks simple, so it is easy to relax. Black’s rook aims across the fifth rank at your passed pawn on a5.',
          },
          { tone: 'blunder', uci: 'g1f2', text: 'Kf2 activates the king on autopilot and leaves a5 loose.' },
          {
            tone: 'punishment',
            uci: 'd5a5',
            text: 'Rxa5 takes your passed pawn for free. In endgames, every single pawn can decide the game.',
          },
        ],
      },
      {
        id: 'endgame-backrank',
        title: 'Promotion tunnel vision',
        fen: '4r1k1/1R3ppp/P7/8/8/8/5PPP/6K1 w - - 0 39',
        sideToMove: 'w',
        arrows: [{ from: 'e8', to: 'e1' }],
        beats: [
          {
            tone: 'setup',
            text: 'Your passed pawn on a6 is almost a queen. Before pushing it, check your own king: Black’s rook threatens Re1#.',
          },
          { tone: 'blunder', uci: 'a6a7', text: 'a7 races to promote while leaving the king boxed in.' },
          {
            tone: 'punishment',
            uci: 'e8e1',
            text: 'Re1# ends the game on the spot. Always give your king air before pushing for promotion.',
          },
        ],
      },
    ],
    tries: [
      puzzle({
        id: 'lesson-endgame-pawn',
        fen: '8/5pk1/6p1/P2r3p/8/5P2/4R1PP/6K1 w - - 0 38',
        side: 'w',
        theme: 'hanging',
        atRisk: 'a5',
        prompt: 'Keep your passed pawn on a5 safe.',
        note: 'Ra2 puts your rook behind the passed pawn to defend it. a6 also steps off the fifth rank.',
        solution: ['e2a2', 'a5a6'],
        coach: 'Put your rook behind the passed pawn — or push it off Black’s rook rank.',
        blunder: 'g1f2',
        kind: 'hanging',
      }),
      puzzle({
        id: 'lesson-endgame-backrank',
        fen: '4r1k1/1R3ppp/P7/8/8/8/5PPP/6K1 w - - 0 39',
        side: 'w',
        theme: 'back_rank',
        atRisk: 'g1',
        prompt: 'Do not rush the a-pawn yet. Stop back-rank mate first.',
        note: 'h3, g3, or Kf1 stops Re1# so your passed pawn stays completely safe next turn.',
        solution: ['h2h3', 'g2g3', 'g1f1'],
        coach: 'Your king has no escape square. Make luft or step the king out before pushing a7.',
        blunder: 'a6a7',
        kind: 'back_rank',
      }),
    ],
  },
];

export const ALL_LESSONS: readonly Lesson[] = [...LESSONS, ...CLUB_LESSONS, ...HABIT_LESSONS];

export function parseLessonId(value: string | undefined): LessonId | null {
  if (!value) return null;
  switch (value) {
    case 'blunder':
    case 'hanging':
    case 'fork':
    case 'pin':
    case 'back_rank':
    case 'mate':
    case 'counting':
    case 'overloaded':
    case 'discovered':
    case 'quiet_trap':
    case 'routine':
    case 'opening_traps':
    case 'counterplay':
    case 'endgame_safety':
      return value;
    default:
      return null;
  }
}

export function lessonById(id: LessonId): Lesson {
  const lesson = ALL_LESSONS.find((item) => item.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
}

export function withLessonComplete(completed: readonly string[], id: string): string[] {
  if (completed.includes(id)) return [...completed];
  return [...completed, id];
}

/** First unfinished lesson in the suggested core order. Null when the six foundations are done. */
export function nextLessonId(completed: readonly string[]): LessonId | null {
  for (const id of ORDER) {
    if (!completed.includes(id)) return id;
  }
  return null;
}

/** First unfinished lesson across both Foundations and Club tracks. */
export function nextCourseLessonId(completed: readonly string[]): LessonId | null {
  for (const lesson of ALL_LESSONS) {
    if (!completed.includes(lesson.id)) return lesson.id;
  }
  return null;
}

export function learnCard(completed: readonly string[]): { href: string; title: string; body: string } {
  const next = nextLessonId(completed);
  if (!next) {
    return {
      href: '/learn',
      title: 'Learn',
      body: 'All six lessons done. Review any idea.',
    };
  }
  const lesson = lessonById(next);
  const started = ORDER.some((id) => completed.includes(id));
  return {
    href: `/learn?lesson=${lesson.id}`,
    title: 'Learn',
    body: started ? `Continue: ${lesson.title}` : `Start: ${lesson.title}`,
  };
}

export function practiceHref(lesson: Lesson): string {
  return drillHref('play', lesson.practice);
}
