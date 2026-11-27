import { Chess, type Square } from 'chess.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

import { getAllDrills, isCorrectDrillMove, type DrillPosition } from '@/src/logic/drills';
import { PUZZLE_POOL_SIZE } from '@/src/logic/puzzlePool';
import { moveOutcome } from '@/src/logic/safety';
import { drillStreakExtra, shownBest, STREAK_SCORE_MAX, streakScoreInRange, streakWeekStart } from '@/src/logic/streak';
import { initialTrainerRound, stepTrainerRound, type TrainerRoundState } from '@/src/logic/trainerRound';
import { useProgressStore } from '@/src/store/progress';

function drill(id: string): DrillPosition {
  const found = getAllDrills().find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function answer(state: TrainerRoundState, position: DrillPosition, uci: string, sudden: boolean) {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const correct = isCorrectDrillMove(position, from, to);
  return stepTrainerRound(state, {
    type: 'answer',
    correct,
    afterFen: 'after',
    move: { from, to },
    san: uci,
    line: [],
    sudden,
    missText: correct ? '' : 'That loses material.',
  });
}

afterEach(() => {
  useProgressStore.setState({ bestPuzzleStreak: 0 });
});

describe('streak week', () => {
  it('resets on Monday at 00:00 UTC, including across the year', () => {
    expect(streakWeekStart(new Date('2026-11-26T23:59:00.000Z'))).toBe('2026-11-23');
    expect(streakWeekStart(new Date('2026-11-23T00:00:00.000Z'))).toBe('2026-11-23');
    expect(streakWeekStart(new Date('2026-11-23T00:30:00.000Z'))).toBe('2026-11-23');
    expect(streakWeekStart(new Date('2026-11-22T23:59:59.000Z'))).toBe('2026-11-16');
    expect(streakWeekStart(new Date('2026-01-01T12:00:00.000Z'))).toBe('2025-12-29');
  });
});

describe('streak score', () => {
  it('caps a run at the puzzle pool and shows the current and best counts', () => {
    expect(STREAK_SCORE_MAX).toBe(PUZZLE_POOL_SIZE);
    expect(STREAK_SCORE_MAX).toBe(100);
    expect(streakScoreInRange(1)).toBe(true);
    expect(streakScoreInRange(100)).toBe(true);
    expect(streakScoreInRange(0)).toBe(false);
    expect(streakScoreInRange(101)).toBe(false);
    expect(streakScoreInRange(1.5)).toBe(false);
    expect(shownBest(3, 8)).toBe(8);
    expect(shownBest(9, 8)).toBe(9);
    expect(drillStreakExtra(false, 2, 5, true)).toBeUndefined();
    expect(drillStreakExtra(true, 2, 5, true)).toBe('2 · best 5');
    expect(drillStreakExtra(true, 6, 4, true)).toBe('6 · best 6');
    expect(drillStreakExtra(true, 2, 5, false)).toBe('2 in a row · best 5');
  });

  it('keeps the best run on the device when a later run is shorter', () => {
    useProgressStore.setState({ bestPuzzleStreak: 4 });
    useProgressStore.getState().recordPuzzleRun(2);
    expect(useProgressStore.getState().bestPuzzleStreak).toBe(4);
    useProgressStore.getState().recordPuzzleRun(6);
    expect(useProgressStore.getState().bestPuzzleStreak).toBe(6);
  });
});

describe('streak moves', () => {
  it('continues on any safe move and ends on the first blunder', () => {
    const hanging = drill('hang-p-01');
    const game = new Chess(hanging.fen);
    const safe = game
      .moves({ verbose: true })
      .filter((move) => isCorrectDrillMove(hanging, move.from, move.to))
      .map((move) => `${move.from}${move.to}`);
    const blunders = game
      .moves({ verbose: true })
      .filter((move) => !isCorrectDrillMove(hanging, move.from, move.to))
      .map((move) => `${move.from}${move.to}`);
    expect(safe.length).toBeGreaterThan(1);
    expect(blunders).toContain('d8g5');
    const extra = safe.find((uci) => uci !== hanging.solution[0]);
    expect(extra).toBeTruthy();

    const first = answer(initialTrainerRound(), hanging, extra ?? safe[0]!, true);
    expect(first.state.phase).toBe('correct');
    expect(first.state.runOver).toBe(false);
    expect(first.state.score.correct).toBe(1);
    expect(first.effects).toEqual([{ type: 'recordResult', correct: true }]);

    const continued = stepTrainerRound(first.state, { type: 'advance', length: 5, wrap: false });
    const secondSafe = safe.find((uci) => uci !== extra) ?? safe[0]!;
    const second = answer(continued.state, hanging, secondSafe, true);
    expect(second.state.score.correct).toBe(2);
    expect(second.state.runOver).toBe(false);

    const next = stepTrainerRound(second.state, { type: 'advance', length: 5, wrap: false });
    const missed = answer(next.state, hanging, 'd8g5', true);
    expect(isCorrectDrillMove(hanging, 'd8', 'g5')).toBe(false);
    expect(moveOutcome(hanging.fen, 'd8', 'g5', 'b')).toBeLessThan(0);
    expect(missed.state.phase).toBe('streakEnd');
    expect(missed.state.runOver).toBe(true);
    expect(missed.state.score.correct).toBe(2);
    expect(missed.effects).toContainEqual({ type: 'recordRun', length: 2 });

    const replay = answer(
      stepTrainerRound(missed.state, { type: 'tryAgain', fen: hanging.fen }).state,
      hanging,
      extra ?? safe[0]!,
      true,
    );
    expect(replay.state.score.correct).toBe(2);
    expect(replay.effects).toEqual([]);
  });

  it('treats an equal trade as a save and mate in 1 as the end of the run', () => {
    const trade = '8/8/4p3/3p4/4P3/8/8/4K2k w - - 0 1';
    expect(moveOutcome(trade, 'e4', 'd5', 'w')).toBe(0);

    const mate = drill('mate-01');
    expect(isCorrectDrillMove(mate, 'f6', 'h5')).toBe(true);
    expect(isCorrectDrillMove(mate, 'e8', 'e7')).toBe(false);
    expect(moveOutcome(mate.fen, 'e8', 'e7', 'b')).toBeLessThan(0);

    const saved = answer(initialTrainerRound(), mate, 'f6h5', true);
    expect(saved.state.phase).toBe('correct');
    expect(saved.state.score.correct).toBe(1);

    const ended = answer(
      stepTrainerRound(saved.state, { type: 'advance', length: 4, wrap: false }).state,
      mate,
      'e8e7',
      true,
    );
    expect(ended.state.phase).toBe('streakEnd');
    expect(ended.state.score.correct).toBe(1);
    expect(ended.effects).toContainEqual({ type: 'recordRun', length: 1 });

    const guided = answer(initialTrainerRound(), mate, 'e8e7', false);
    expect(guided.state.phase).toBe('retry');
    expect(guided.state.runOver).toBe(false);
    expect(guided.effects.some((effect) => effect.type === 'recordRun')).toBe(false);
  });

  it('does not end a run on a save that only leaves a longer mate', () => {
    const position = drill('mate-02');
    expect(isCorrectDrillMove(position, 'b8', 'd7')).toBe(true);
    expect(isCorrectDrillMove(position, 'f7', 'f6')).toBe(true);
    const first = answer(initialTrainerRound(), position, 'b8d7', true);
    const second = answer(
      stepTrainerRound(first.state, { type: 'advance', length: 4, wrap: false }).state,
      position,
      'f7f6',
      true,
    );
    expect(second.state.phase).toBe('correct');
    expect(second.state.runOver).toBe(false);
    expect(second.state.score.correct).toBe(2);
  });
});
