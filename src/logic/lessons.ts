import { Chess, type Square } from 'chess.js';

import { drillHref, type ThemeFilter } from '@/src/logic/drillLink';
import type { DrillPosition, DrillTheme } from '@/src/logic/drills';

export type LessonId = 'blunder' | 'hanging' | 'fork' | 'pin' | 'back_rank' | 'mate';

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
        coach: 'Your queen is loose. Save her.',
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
        coach: 'Take their rook. A fair trade is allowed.',
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
        coach: 'The queen can mate on h4. Stop that check.',
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
        coach: 'The knight attacks your queen. Save her.',
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
        coach: 'Your rook is hanging. Move it to a safe square.',
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
        coach: 'Your bishop is hanging. Move it or defend it.',
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
        coach: 'The knight forks your queen and rook. Take the knight.',
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
        coach: 'Capture the knight. Stepping the king loses the rook.',
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
        coach: 'A pawn can take the knight. That saves both pieces.',
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
        coach: 'Your knight is pinned to the king. Take the bishop.',
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
        coach: 'The rook pins your knight. Do not leave it hanging.',
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
        coach: 'The rook on b8 can mate on b1. Give the king a square.',
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
        coach: 'The rook on c8 can mate on c1. Do not leave that square.',
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
        coach: 'They threaten mate on h4. Stop that check.',
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
        coach: 'They threaten mate on f7. Stop that check.',
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
        coach: 'The queen can mate on d8. Stop that check.',
        blunder: 'b8a6',
        kind: 'missed_mate',
      }),
    ],
  },
];

export function parseLessonId(value: string | undefined): LessonId | null {
  if (!value) return null;
  switch (value) {
    case 'blunder':
    case 'hanging':
    case 'fork':
    case 'pin':
    case 'back_rank':
    case 'mate':
      return value;
    default:
      return null;
  }
}

export function lessonById(id: LessonId): Lesson {
  const lesson = LESSONS.find((item) => item.id === id);
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
}

export function withLessonComplete(completed: readonly string[], id: string): string[] {
  if (completed.includes(id)) return [...completed];
  return [...completed, id];
}

/** First unfinished lesson in the suggested order. Null when the course is done. */
export function nextLessonId(completed: readonly string[]): LessonId | null {
  for (const id of ORDER) {
    if (!completed.includes(id)) return id;
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
