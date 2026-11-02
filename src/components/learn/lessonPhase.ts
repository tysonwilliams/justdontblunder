import type { Square } from 'chess.js';

import type { DrillRound } from '@/src/logic/saveFeedback';
import type { Lesson, LessonId, ResolvedBeat } from '@/src/logic/lessons';

export type LessonPhase = { kind: 'card'; index: number } | { kind: 'try'; index: number } | { kind: 'done' };

export function nextPhase(lesson: Lesson, phase: LessonPhase): LessonPhase {
  switch (phase.kind) {
    case 'card':
      if (phase.index + 1 < lesson.cards.length) return { kind: 'card', index: phase.index + 1 };
      return { kind: 'try', index: 0 };
    case 'try':
      if (phase.index + 1 < lesson.tries.length) return { kind: 'try', index: phase.index + 1 };
      return { kind: 'done' };
    case 'done':
      return phase;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function doneCopy(id: LessonId): string {
  switch (id) {
    case 'blunder':
      return 'A blunder loses a piece for nothing, or lets mate in one happen. An even trade is fine.';
    case 'hanging':
      return 'Before you move, ask: is anything of mine hanging?';
    case 'fork':
      return 'One piece attacking two of yours is a fork. Check the knights first.';
    case 'pin':
      return 'A pinned piece is stuck in front of something more valuable. Do not leave it loose.';
    case 'back_rank':
      return 'A king behind its own pawns needs a square, or a piece covering the first rank.';
    case 'mate':
      return 'Look for every check they have. Stop mate in one before you do anything else.';
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export const LESSON_INDEX: Record<LessonId, number> = {
  blunder: 1,
  hanging: 2,
  fork: 3,
  pin: 4,
  back_rank: 5,
  mate: 6,
};

export function squaresForBeat(beat: ResolvedBeat): { squares: Square[]; tone: 'danger' | 'success' } {
  if (!beat.lastMove) return { squares: [], tone: 'danger' };
  switch (beat.tone) {
    case 'setup':
      return { squares: [], tone: 'danger' };
    case 'blunder':
    case 'punishment':
      return { squares: [beat.lastMove.from, beat.lastMove.to], tone: 'danger' };
    case 'ok':
      return { squares: [beat.lastMove.from, beat.lastMove.to], tone: 'success' };
    default: {
      const _exhaustive: never = beat.tone;
      return _exhaustive;
    }
  }
}

export function roundKind(round: 'playing' | 'correct' | 'retry' | 'revealed'): DrillRound {
  switch (round) {
    case 'playing':
      return 'playing';
    case 'correct':
      return 'correct';
    case 'retry':
      return 'retry';
    case 'revealed':
      return 'revealed';
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}
