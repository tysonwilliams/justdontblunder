import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { drillTrap, getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { punishmentLine } from '@/src/logic/punishment';
import { presentSafeChoice, safeChoiceFor } from '@/src/logic/safeChoice';
import { bestPunishment, moveOutcome } from '@/src/logic/safety';

function drill(id: string) {
  const found = getAllDrills().find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe('pick the safe move', () => {
  it('builds one passing move and one real blunder for every drill', () => {
    let safeOnA = 0;
    let safeOnB = 0;
    for (const item of getAllDrills()) {
      const choice = safeChoiceFor(item);
      expect(choice, item.id).not.toBeNull();
      if (!choice) continue;

      expect(choice.safe.uci).not.toBe(choice.blunder.uci);

      expect(isCorrectDrillMove(item, choice.safe.from, choice.safe.to), `${item.id} safe`).toBe(
        true,
      );
      expect(drillTrap(item, choice.safe.from, choice.safe.to), `${item.id} safe trap`).toBeNull();
      const safeOutcome = moveOutcome(item.fen, choice.safe.from, choice.safe.to, item.sideToMove);
      expect(safeOutcome, `${item.id} safe material`).not.toBeNull();
      expect(safeOutcome!, `${item.id} safe material`).toBeGreaterThanOrEqual(0);

      expect(
        isCorrectDrillMove(item, choice.blunder.from, choice.blunder.to),
        `${item.id} blunder`,
      ).toBe(false);
      const blunderOutcome = moveOutcome(
        item.fen,
        choice.blunder.from,
        choice.blunder.to,
        item.sideToMove,
      );
      const trap = drillTrap(item, choice.blunder.from, choice.blunder.to);
      expect(blunderOutcome, `${item.id} blunder material`).not.toBeNull();
      expect(
        blunderOutcome! < 0 || trap !== null,
        `${item.id} blunder is material, mate, or a trap`,
      ).toBe(true);

      const shown = presentSafeChoice(choice);
      const safe = shown.options.find((option) => option.key === shown.safeKey);
      const blunder = shown.options.find((option) => option.key === shown.blunderKey);
      expect(safe?.uci).toBe(choice.safe.uci);
      expect(blunder?.uci).toBe(choice.blunder.uci);
      expect(shown.safeKey).not.toBe(shown.blunderKey);
      if (shown.safeKey === 'A') safeOnA += 1;
      else safeOnB += 1;
    }
    expect(safeOnA).toBeGreaterThan(0);
    expect(safeOnB).toBeGreaterThan(0);
  }, 60000);

  it('keeps the teaching save and a curated trap when the drill has one', () => {
    const queen = safeChoiceFor(drill('hang-q-01'));
    expect(queen?.safe.uci).toBe('h5e5');
    expect(queen?.safe.san).toBe('Qxe5+');
    expect(isCorrectDrillMove(drill('hang-q-01'), 'h5', 'e5')).toBe(true);

    const trapped = safeChoiceFor(drill('hang-q-02'));
    expect(trapped?.blunder.uci).toBe('d5c6');
    expect(isCorrectDrillMove(drill('hang-q-02'), 'd5', 'c6')).toBe(false);
    expect(drillTrap(drill('hang-q-02'), 'd5', 'c6')).not.toBeNull();
  });
});

describe('punishment line', () => {
  it('plays the capture that wins the queen', () => {
    const line = punishmentLine(drill('hang-q-03'), 'h4', 'g5');
    expect(line).toHaveLength(1);
    expect(line[0]?.san).toBe('Nxg5');
    expect(line[0]?.captured).toBe(true);
    expect(line[0]?.mate).toBe(false);
    expect(`${line[0]?.from}${line[0]?.to}`).toBe('f3g5');
  });

  it('plays mate in 1', () => {
    const line = punishmentLine(drill('back-01'), 'b8', 'c6');
    expect(line).toHaveLength(1);
    expect(line[0]?.mate).toBe(true);
    expect(line[0]?.san).toBe('Re8#');
  });

  it('steps through the precomputed two-move trap', () => {
    const item = drill('hang-q-02');
    const trap = drillTrap(item, 'd5', 'c6');
    const line = punishmentLine(item, 'd5', 'c6');
    expect(line.map((step) => `${step.from}${step.to}`)).toEqual(trap?.line);
    expect(line.at(-1)?.san).toBe('Bxc6+');
    expect(line.at(-1)?.captured).toBe(true);
  });

  it('is a legal punishment for every selected blunder', () => {
    for (const item of getAllDrills()) {
      const choice = safeChoiceFor(item);
      expect(choice, item.id).not.toBeNull();
      if (!choice) continue;
      const line = punishmentLine(item, choice.blunder.from, choice.blunder.to);
      expect(line.length, item.id).toBeGreaterThan(0);

      const game = new Chess(item.fen);
      const student = game.move({
        from: choice.blunder.from,
        to: choice.blunder.to,
        promotion: 'q',
      });
      expect(student, item.id).toBeTruthy();

      const trap = drillTrap(item, choice.blunder.from, choice.blunder.to);
      if (trap) {
        expect(line.map((step) => `${step.from}${step.to}`), item.id).toEqual(trap.line);
      } else {
        const hit = bestPunishment(game.fen());
        expect(hit, item.id).not.toBeNull();
        expect(`${line[0]?.from}${line[0]?.to}`, item.id).toBe(`${hit?.from}${hit?.to}`);
        expect(line[0]?.mate || line[0]?.captured, item.id).toBe(true);
      }

      for (const step of line) {
        const played = game.move({
          from: step.from as Square,
          to: step.to as Square,
          promotion: 'q',
        });
        expect(played?.san, `${item.id} ${step.san}`).toBe(step.san);
        expect(game.fen(), item.id).toBe(step.fen);
      }
    }
  }, 60000);
});
