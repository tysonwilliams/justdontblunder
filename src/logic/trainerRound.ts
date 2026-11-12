import type { Square } from 'chess.js';

import type { PunishmentStep } from '@/src/logic/punishment';
import type { DrillRound } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';

export type TrainerPhase = DrillRound;

export type TrainerMove = { from: Square; to: Square };

export type MissedPlay = {
  san: string | null;
  text: string;
  fen: string;
  lastMove: TrainerMove;
};

export type RoundScore = { correct: number; total: number };

export type TrainerRoundState = {
  index: number;
  phase: TrainerPhase;
  lastMove: TrainerMove | null;
  /** Null shows the puzzle fen. A move or a revealed idea replaces it. */
  displayFen: string | null;
  replayLine: PunishmentStep[];
  score: RoundScore;
  /** The first outcome of this puzzle has already moved the tallies. */
  claimed: boolean;
  shownIdea: boolean;
  /** A sudden-death miss already ended the run. Later tries do not score. */
  runOver: boolean;
  runRecorded: boolean;
  missedPlay: MissedPlay | null;
};

export type TrainerEffect =
  | { type: 'recordResult'; correct: boolean }
  | { type: 'recordRun'; length: number };

export type TrainerStep = {
  state: TrainerRoundState;
  effects: TrainerEffect[];
  /** False when the action was ignored, such as a move after the puzzle is over. */
  accepted: boolean;
};

export type TrainerAction =
  | { type: 'begin' }
  | { type: 'advance'; length: number; wrap: boolean }
  | { type: 'tryAgain'; fen: string | null }
  | { type: 'loadPuzzle'; fen: string }
  | {
      type: 'answer';
      correct: boolean;
      afterFen: string;
      move: TrainerMove;
      san: string | null;
      line: PunishmentStep[];
      sudden: boolean;
      missText: string;
    }
  | {
      type: 'reveal';
      sudden: boolean;
      move: { from: Square; to: Square; fen: string } | null;
    }
  | { type: 'finishRun' };

export function initialTrainerRound(): TrainerRoundState {
  return {
    index: 0,
    phase: 'playing',
    lastMove: null,
    displayFen: null,
    replayLine: [],
    score: { correct: 0, total: 0 },
    claimed: false,
    shownIdea: false,
    runOver: false,
    runRecorded: false,
    missedPlay: null,
  };
}

export function roundProgress(index: number, phase: TrainerPhase, total: number): number {
  if (total <= 0) return 0;
  return (index + (phase === 'playing' ? 0 : 1)) / total;
}

export function trainerBoard(
  playback: { fen: string | null; move: TrainerMove | null; done: boolean },
  round: Pick<TrainerRoundState, 'displayFen' | 'lastMove'>,
  puzzleFen: string,
  replayActive: boolean,
): { fen: string; lastMove: TrainerMove | null; replyReady: boolean; watchingReply: boolean } {
  return {
    fen: playback.fen ?? round.displayFen ?? puzzleFen,
    lastMove: playback.move ?? round.lastMove,
    replyReady: !replayActive || playback.done,
    watchingReply: replayActive && !playback.done,
  };
}

function keep(state: TrainerRoundState): TrainerStep {
  return { state, effects: [], accepted: false };
}

function step(state: TrainerRoundState, effects: TrainerEffect[] = []): TrainerStep {
  return { state, effects, accepted: true };
}

function scoreWith(score: RoundScore, correct: boolean): RoundScore {
  return {
    correct: score.correct + (correct ? 1 : 0),
    total: score.total + 1,
  };
}

/** Score and emit a result only the first time this puzzle is decided. */
function firstResult(
  state: TrainerRoundState,
  correct: boolean,
): { claimed: true; score: RoundScore; effects: TrainerEffect[] } {
  const result = claimDrillResult(state.claimed);
  if (!result.recorded) return { claimed: true, score: state.score, effects: [] };
  return {
    claimed: true,
    score: scoreWith(state.score, correct),
    effects: [{ type: 'recordResult', correct }],
  };
}

function clearPuzzle(state: TrainerRoundState, index: number, displayFen: string | null): TrainerRoundState {
  return {
    ...state,
    index,
    phase: 'playing',
    lastMove: null,
    displayFen,
    replayLine: [],
    claimed: false,
    shownIdea: false,
    missedPlay: null,
  };
}

function answer(state: TrainerRoundState, action: Extract<TrainerAction, { type: 'answer' }>): TrainerStep {
  if (state.phase !== 'playing') return keep(state);
  const placed = { displayFen: action.afterFen, lastMove: action.move };
  if (action.correct) {
    const scored = state.runOver ? null : firstResult(state, true);
    return step(
      {
        ...state,
        ...placed,
        replayLine: [],
        phase: 'correct',
        claimed: state.runOver ? state.claimed : true,
        score: scored?.score ?? state.score,
      },
      scored?.effects ?? [],
    );
  }
  if (action.sudden) {
    if (state.runOver) {
      return step({ ...state, ...placed, replayLine: action.line, phase: 'streakEnd' });
    }
    const scored = firstResult(state, false);
    const effects = [...scored.effects];
    if (!state.runRecorded) effects.push({ type: 'recordRun', length: state.score.correct });
    return step(
      {
        ...state,
        ...placed,
        replayLine: action.line,
        phase: 'streakEnd',
        claimed: true,
        score: scored.score,
        runOver: true,
        runRecorded: true,
        missedPlay: {
          san: action.san,
          text: action.missText,
          fen: action.afterFen,
          lastMove: action.move,
        },
      },
      effects,
    );
  }
  const scored = firstResult(state, false);
  return step(
    {
      ...state,
      ...placed,
      replayLine: action.line,
      phase: 'retry',
      claimed: true,
      score: scored.score,
    },
    scored.effects,
  );
}

function reveal(state: TrainerRoundState, action: Extract<TrainerAction, { type: 'reveal' }>): TrainerStep {
  if (state.phase !== 'playing') return keep(state);
  const scored = firstResult(state, false);
  const effects = [...scored.effects];
  if (action.sudden && !state.runRecorded) {
    effects.push({ type: 'recordRun', length: state.score.correct });
  }
  return step(
    {
      ...state,
      shownIdea: true,
      claimed: true,
      score: scored.score,
      displayFen: action.move?.fen ?? state.displayFen,
      lastMove: action.move ? { from: action.move.from, to: action.move.to } : state.lastMove,
      phase: action.sudden ? 'streakEnd' : 'revealed',
      runRecorded: action.sudden ? true : state.runRecorded,
    },
    effects,
  );
}

export function stepTrainerRound(state: TrainerRoundState, action: TrainerAction): TrainerStep {
  switch (action.type) {
    case 'begin':
      return step(initialTrainerRound());
    case 'advance': {
      if (action.wrap && action.length <= 0) return keep(state);
      const index = action.wrap ? (state.index + 1) % action.length : state.index + 1;
      return step(clearPuzzle(state, index, null));
    }
    case 'tryAgain':
      return step({
        ...state,
        phase: 'playing',
        lastMove: null,
        displayFen: action.fen,
        replayLine: [],
      });
    case 'loadPuzzle':
      return step(clearPuzzle(state, state.index, action.fen));
    case 'answer':
      return answer(state, action);
    case 'reveal':
      return reveal(state, action);
    case 'finishRun':
      if (state.runRecorded) return keep(state);
      return step({ ...state, runRecorded: true }, [{ type: 'recordRun', length: state.score.correct }]);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
