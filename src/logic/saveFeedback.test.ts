import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { feedbackForRound, missFeedback, saveFeedback } from '@/src/logic/saveFeedback';
import { getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';

function drill(id: string) {
  const found = getAllDrills().find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe('saveFeedback', () => {
  it('describes Qxe5+ instead of the hint about squares that are still hanging', () => {
    const hanging = drill('hang-q-01');
    const text = saveFeedback(hanging, 'h5', 'e5');
    expect(text).toBe('Qxe5+ takes the pawn and gets your queen off h5.');
    expect(text).not.toBe(hanging.note);
    expect(text).not.toMatch(/g4|g6|h6/);
    expect(text).not.toMatch(/still hanging/i);
    expect(text).not.toMatch(/Move her/i);
  });

  it('describes the move on the next hanging-queen drills instead of the imperative hint', () => {
    const second = drill('hang-q-02');
    expect(saveFeedback(second, 'd5', 'd6')).toBe('Qd6 gets your queen off d5.');
    expect(saveFeedback(second, 'd5', 'd6')).not.toMatch(/Move her/i);

    const third = drill('hang-q-03');
    expect(saveFeedback(third, 'h4', 'e4')).toBe(
      'Qxe4+ takes the pawn and gets your queen off h4.',
    );
    expect(saveFeedback(third, 'h4', 'e4')).not.toMatch(/Get her|before/i);
  });

  it('keeps success copy about the move actually played for every accepted solution', () => {
    for (const item of getAllDrills()) {
      for (const sol of item.solution) {
        const from = sol.slice(0, 2) as Square;
        const to = sol.slice(2, 4) as Square;
        if (!isCorrectDrillMove(item, from, to)) continue;
        const probe = new Chess(item.fen);
        let san: string;
        try {
          const move = probe.move({ from, to, promotion: 'q' });
          if (!move) continue;
          san = move.san;
        } catch {
          continue;
        }
        const text = saveFeedback(item, from, to);
        expect(text.startsWith(san), `${item.id} ${san} -> ${text}`).toBe(true);
        expect(text, item.id).not.toBe(item.note);
        expect(text.toLowerCase(), `${item.id} ${text}`).not.toContain('still hanging');
        expect(text, `${item.id} ${text}`).not.toMatch(/\bMove (her|it|the)\b/);
        expect(text, `${item.id} ${text}`).not.toMatch(/\bGet (her|it)\b/);
      }
    }
  });
});

describe('missFeedback', () => {
  it('describes the square the queen moved to when the knight still wins it', () => {
    const third = drill('hang-q-03');
    const text = missFeedback(third, 'h4', 'g5');
    expect(text).toBe('g5 is still attacked by the knight — Nxg5 wins your queen.');
    expect(text).not.toMatch(/h4/);
    expect(text).not.toBe(third.note);
  });

  it('names the capture that refutes the move actually played', () => {
    const text = missFeedback(drill('hang-q-02'), 'd5', 'd2');
    expect(text).toMatch(/Bxd2/);
    expect(text).toMatch(/wins your queen/);
    expect(text).not.toMatch(/Move her off d5/);
  });

  it('names the opponent who delivers the mate', () => {
    const asBlack = drill('back-01');
    expect(asBlack.sideToMove).toBe('b');
    expect(missFeedback(asBlack, 'b8', 'c6')).toBe('White plays Re8#.');

    const asWhite = drill('back-02');
    expect(asWhite.sideToMove).toBe('w');
    const text = missFeedback(asWhite, 'a3', 'a4');
    expect(text.startsWith('Black plays ')).toBe(true);
    expect(text).toMatch(/#/);
  });
});

describe('feedbackForRound', () => {
  const hanging = drill('hang-q-01');
  const save = { from: 'h5' as const, to: 'e5' as const };

  it('uses the played save on success, the hint on reveal, and the refutation on a miss', () => {
    expect(feedbackForRound('correct', hanging, save)).toBe(
      'Qxe5+ takes the pawn and gets your queen off h5.',
    );
    expect(feedbackForRound('revealed', hanging, save)).toBe(hanging.note);
    expect(feedbackForRound('streakEnd', hanging, { from: 'h5', to: 'g4' })).toMatch(/wins your queen/);
    expect(feedbackForRound('retry', hanging, { from: 'h5', to: 'g4' })).toMatch(/wins your queen/);
    expect(feedbackForRound('playing', hanging, null)).toBeNull();
  });
});
