import { readFileSync } from 'node:fs';

import type { Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import type { PunishmentStep } from '@/src/logic/punishment';
import {
  initialTrainerRound,
  roundProgress,
  stepTrainerRound,
  trainerBoard,
  type TrainerRoundState,
} from '@/src/logic/trainerRound';

const line: PunishmentStep = {
  from: 'd8' as Square,
  to: 'h4' as Square,
  san: 'Qh4',
  fen: 'punished',
  mate: false,
  captured: true,
};

function play(state: TrainerRoundState, correct: boolean, sudden = false) {
  return stepTrainerRound(state, {
    type: 'answer',
    correct,
    afterFen: correct ? 'saved' : 'blundered',
    move: { from: 'e2', to: 'e4' },
    san: correct ? 'e4' : 'Qh5',
    line: correct ? [] : [line],
    sudden,
    missText: 'The queen takes it.',
  });
}

describe('trainer round', () => {
  it('records a save once, and try again does not score the same puzzle', () => {
    const saved = play(initialTrainerRound(), true);
    expect(saved.accepted).toBe(true);
    expect(saved.state.phase).toBe('correct');
    expect(saved.state.score).toEqual({ correct: 1, total: 1 });
    expect(saved.state.replayLine).toEqual([]);
    expect(saved.effects).toEqual([{ type: 'recordResult', correct: true }]);

    const again = stepTrainerRound(saved.state, { type: 'tryAgain', fen: 'start' });
    expect(again.state.phase).toBe('playing');
    expect(again.state.displayFen).toBe('start');
    expect(again.state.lastMove).toBeNull();
    expect(again.state.claimed).toBe(true);
    expect(again.effects).toEqual([]);

    const retry = play(again.state, true);
    expect(retry.effects).toEqual([]);
    expect(retry.state.score).toEqual({ correct: 1, total: 1 });
    expect(retry.state.phase).toBe('correct');
  });

  it('records a blunder once, then counts the next puzzle after advance', () => {
    const missed = play(initialTrainerRound(), false);
    expect(missed.state.phase).toBe('retry');
    expect(missed.state.replayLine).toEqual([line]);
    expect(missed.state.score).toEqual({ correct: 0, total: 1 });
    expect(missed.effects).toEqual([{ type: 'recordResult', correct: false }]);

    const retried = play(stepTrainerRound(missed.state, { type: 'tryAgain', fen: null }).state, false);
    expect(retried.effects).toEqual([]);
    expect(retried.state.score).toEqual({ correct: 0, total: 1 });

    const advanced = stepTrainerRound(missed.state, { type: 'advance', length: 4, wrap: false });
    expect(advanced.state.index).toBe(1);
    expect(advanced.state.phase).toBe('playing');
    expect(advanced.state.claimed).toBe(false);
    expect(advanced.state.score).toEqual({ correct: 0, total: 1 });

    const next = play(advanced.state, true);
    expect(next.effects).toEqual([{ type: 'recordResult', correct: true }]);
    expect(next.state.score).toEqual({ correct: 1, total: 2 });
  });

  it('wraps the home pack and ignores a move that arrives after the puzzle is over', () => {
    let state = initialTrainerRound();
    state = { ...state, index: 6 };
    const wrapped = stepTrainerRound(state, { type: 'advance', length: 7, wrap: true });
    expect(wrapped.state.index).toBe(0);
    expect(stepTrainerRound(initialTrainerRound(), { type: 'advance', length: 0, wrap: true }).accepted).toBe(false);

    const saved = play(initialTrainerRound(), true);
    const late = play(saved.state, false);
    expect(late.accepted).toBe(false);
    expect(late.state).toBe(saved.state);
    expect(roundProgress(6, 'playing', 7)).toBeCloseTo(6 / 7);
    expect(roundProgress(6, 'correct', 7)).toBe(1);
    expect(roundProgress(0, 'playing', 0)).toBe(0);
  });

  it('ends a sudden-death run on the first miss and does not score the replay', () => {
    const first = play(initialTrainerRound(), true);
    const continued = stepTrainerRound(first.state, { type: 'advance', length: 5, wrap: false });
    const missed = play(continued.state, false, true);
    expect(missed.state.phase).toBe('streakEnd');
    expect(missed.state.runOver).toBe(true);
    expect(missed.state.score).toEqual({ correct: 1, total: 2 });
    expect(missed.state.missedPlay).toMatchObject({ san: 'Qh5', text: 'The queen takes it.', fen: 'blundered' });
    expect(missed.effects).toEqual([
      { type: 'recordResult', correct: false },
      { type: 'recordRun', length: 1 },
    ]);

    const replay = stepTrainerRound(missed.state, { type: 'tryAgain', fen: 'start' });
    const saved = play(replay.state, true, true);
    expect(saved.effects).toEqual([]);
    expect(saved.state.score).toEqual({ correct: 1, total: 2 });
    expect(saved.state.phase).toBe('correct');

    const missedAgain = play(stepTrainerRound(saved.state, { type: 'tryAgain', fen: 'start' }).state, false, true);
    expect(missedAgain.effects).toEqual([]);
    expect(missedAgain.state.score).toEqual({ correct: 1, total: 2 });
    expect(missedAgain.state.missedPlay).toBe(missed.state.missedPlay);
    expect(missedAgain.state.phase).toBe('streakEnd');
    expect(missedAgain.state.replayLine).toEqual([line]);
  });

  it('counts show-the-idea as a miss, and records the run only in sudden death', () => {
    const opened = play(initialTrainerRound(), true).state;
    const revealed = stepTrainerRound(opened, {
      type: 'reveal',
      sudden: false,
      move: { from: 'h5', to: 'e5', fen: 'idea' },
    });
    expect(revealed.accepted).toBe(false);

    const fresh = stepTrainerRound(opened, { type: 'advance', length: 3, wrap: false }).state;
    const idea = stepTrainerRound(fresh, {
      type: 'reveal',
      sudden: false,
      move: { from: 'h5', to: 'e5', fen: 'idea' },
    });
    expect(idea.state.phase).toBe('revealed');
    expect(idea.state.shownIdea).toBe(true);
    expect(idea.state.displayFen).toBe('idea');
    expect(idea.state.runOver).toBe(false);
    expect(idea.effects).toEqual([{ type: 'recordResult', correct: false }]);

    const sudden = stepTrainerRound(fresh, {
      type: 'reveal',
      sudden: true,
      move: { from: 'h5', to: 'e5', fen: 'idea' },
    });
    expect(sudden.state.phase).toBe('streakEnd');
    expect(sudden.state.runRecorded).toBe(true);
    expect(sudden.state.runOver).toBe(false);
    expect(sudden.effects).toEqual([
      { type: 'recordResult', correct: false },
      { type: 'recordRun', length: 1 },
    ]);
  });

  it('records a finished sudden-death run once, and begin starts a new one', () => {
    const saved = play(initialTrainerRound(), true).state;
    const first = stepTrainerRound(saved, { type: 'finishRun' });
    expect(first.effects).toEqual([{ type: 'recordRun', length: 1 }]);
    expect(stepTrainerRound(first.state, { type: 'finishRun' }).accepted).toBe(false);

    const restarted = stepTrainerRound(first.state, { type: 'begin' });
    expect(restarted.state.score).toEqual({ correct: 0, total: 0 });
    expect(restarted.state.index).toBe(0);
    expect(restarted.state.runRecorded).toBe(false);
    expect(stepTrainerRound(restarted.state, { type: 'finishRun' }).effects).toEqual([
      { type: 'recordRun', length: 0 },
    ]);
  });

  it('shows the punishment fen ahead of the move the student just played', () => {
    const view = trainerBoard(
      { fen: 'punished', move: { from: 'd8', to: 'h4' }, done: false },
      { displayFen: 'blundered', lastMove: { from: 'e2', to: 'e4' } },
      'start',
      true,
    );
    expect(view.fen).toBe('punished');
    expect(view.lastMove).toEqual({ from: 'd8', to: 'h4' });
    expect(view.replyReady).toBe(false);
    expect(view.watchingReply).toBe(true);

    const quiet = trainerBoard({ fen: null, move: null, done: true }, { displayFen: null, lastMove: null }, 'start', false);
    expect(quiet).toMatchObject({ fen: 'start', lastMove: null, replyReady: true, watchingReply: false });
  });

  it('is the round machine for Home, Play, and Pick', () => {
    const home = readFileSync(new URL('../components/home/useHomeTrainer.ts', import.meta.url), 'utf8');
    const play = readFileSync(new URL('../components/drills/useDrillSession.ts', import.meta.url), 'utf8');
    const pick = readFileSync(new URL('../components/drills/useSafeChoiceSession.ts', import.meta.url), 'utf8');
    for (const source of [home, play, pick]) {
      expect(source).toContain('useTrainerRound(');
      expect(source).toContain('applyRoundEffects(');
    }
  });
});
