import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { getAllDrills } from '@/src/logic/drills';
import { LESSONS, resolveBeats } from '@/src/logic/lessons';
import { plausibilityIssues } from '@/src/logic/plausible';

const SEALED_ROOK = 'rnbqkb1r/pppppppp/5n2/7R/4P3/8/PPPP1PPP/RNBQKBN1 w Qkq - 0 3';

function bundled(): { id: string; fen: string }[] {
  const found: { id: string; fen: string }[] = [];
  for (const drill of getAllDrills()) found.push({ id: drill.id, fen: drill.fen });
  for (const lesson of LESSONS) {
    for (const card of lesson.cards) {
      found.push({ id: card.id, fen: card.fen });
      for (const beat of resolveBeats(card.fen, card.beats)) {
        found.push({ id: `${card.id} ${beat.san ?? 'start'}`, fen: beat.fen });
      }
    }
    for (const exercise of lesson.tries) found.push({ id: exercise.drill.id, fen: exercise.drill.fen });
  }
  return found;
}

describe('position plausibility', () => {
  it('rejects a rook that never had a way out, and accepts a game that was played', () => {
    expect(plausibilityIssues(SEALED_ROOK).join(' ')).toMatch(/rook on h5/i);
    expect(plausibilityIssues('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual([]);
    expect(
      plausibilityIssues('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3'),
    ).toEqual([]);

    const played = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3']) {
      played.move(san);
    }
    expect(plausibilityIssues(played.fen())).toEqual([]);

    expect(plausibilityIssues('rnbqkbnr/pppppppp/8/8/8/P7/P1PPPPPP/RNBQKBNR w KQkq - 0 1').join(' ')).toMatch(
      /capture/i,
    );
    expect(plausibilityIssues('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w KQkq - 0 1').join(' ')).toMatch(
      /kingside castling/i,
    );
    expect(plausibilityIssues('4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1').join(' ')).toMatch(/in check/i);
    expect(plausibilityIssues('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNP w KQ - 0 1').join(' ')).toMatch(
      /edge row/i,
    );
  });

  it('keeps the repaired drills on the positions those games reach', () => {
    const repairs = [
      { id: 'hang-r-01', moves: ['e4', 'h5', 'Bc4', 'h4', 'd3', 'h3', 'Nc3', 'Rh4', 'Nf3'] },
      { id: 'hang-r-02', moves: ['b4', 'a5', 'Bb2', 'Ra6', 'b5'] },
      { id: 'hang-r-03', moves: ['a4', 'b5', 'Ra3', 'b4'] },
      { id: 'hang-r-04', moves: ['h4', 'd6', 'h5', 'a6', 'Rh4', 'e5'] },
      { id: 'hang-n-03', moves: ['e4', 'e5', 'Na3', 'a6', 'Nc4', 'b5'] },
    ] as const;
    for (const repair of repairs) {
      const game = new Chess();
      for (const san of repair.moves) {
        const played = game.move(san);
        expect(played, `${repair.id} ${san}`).toBeTruthy();
      }
      const drill = getAllDrills().find((item) => item.id === repair.id);
      expect(drill?.fen, repair.id).toBe(game.fen());
      expect(plausibilityIssues(game.fen()), repair.id).toEqual([]);
    }
  });

  it('accepts every bundled drill and lesson position', () => {
    const problems = bundled().flatMap((item) =>
      plausibilityIssues(item.fen).map((issue) => `${item.id}: ${issue}`),
    );
    expect(problems).toEqual([]);
  });
});
