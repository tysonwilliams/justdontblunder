import type { Square } from 'chess.js';

import type { BoardArrow } from '@/src/components/Board/boardTypes';
import type { DrillRound } from '@/src/logic/saveFeedback';
import type { Lesson, LessonCard, LessonId, ResolvedBeat } from '@/src/logic/lessons';
import { markColor, type ColorScheme, type Palette } from '@/src/theme';

export type LessonPhase = { kind: 'card'; index: number } | { kind: 'try'; index: number } | { kind: 'done' };

export type LessonStepSlot = {
  kind: 'card' | 'try';
  index: number;
  label: string;
  shortLabel: string;
};

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

export function prevPhase(lesson: Lesson, phase: LessonPhase): LessonPhase | null {
  switch (phase.kind) {
    case 'card':
      if (phase.index > 0) return { kind: 'card', index: phase.index - 1 };
      return null;
    case 'try':
      if (phase.index > 0) return { kind: 'try', index: phase.index - 1 };
      if (lesson.cards.length > 0) return { kind: 'card', index: lesson.cards.length - 1 };
      return null;
    case 'done':
      if (lesson.tries.length > 0) return { kind: 'try', index: lesson.tries.length - 1 };
      if (lesson.cards.length > 0) return { kind: 'card', index: lesson.cards.length - 1 };
      return null;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function lessonSteps(lesson: Lesson): LessonStepSlot[] {
  const out: LessonStepSlot[] = [];
  lesson.cards.forEach((_, index) => {
    out.push({ kind: 'card', index, label: `Example ${index + 1}`, shortLabel: `Ex ${index + 1}` });
  });
  lesson.tries.forEach((_, index) => {
    out.push({ kind: 'try', index, label: `Try ${index + 1}`, shortLabel: `Try ${index + 1}` });
  });
  return out;
}

export function phaseSlotIndex(lesson: Lesson, phase: LessonPhase): number {
  switch (phase.kind) {
    case 'card':
      return phase.index;
    case 'try':
      return lesson.cards.length + phase.index;
    case 'done':
      return lesson.cards.length + lesson.tries.length;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

/**
 * Smooth progress across all examples and tries, advancing per step inside an
 * example card rather than sitting frozen until the card finishes.
 */
export function lessonProgress(
  lesson: Lesson,
  phase: LessonPhase,
  subFraction = 0,
): number {
  const total = lesson.cards.length + lesson.tries.length;
  if (total <= 0) return 1;
  if (phase.kind === 'done') return 1;
  const completedSlots = phaseSlotIndex(lesson, phase);
  const clamped = Math.max(0, Math.min(1, subFraction));
  return Math.min(1, (completedSlots + clamped) / total);
}

/**
 * Calm reading-speed delay for optional Auto-play on lesson examples.
 * Scales with word count (~3.2s for short lines up to 5.5s for rich explanations)
 * so learners have time to read the copy and scan the board.
 */
export function readingDelayMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(5500, Math.max(3200, words * 280 + 900));
}

export type BeatBadge = {
  label: string;
  tone: 'neutral' | 'danger' | 'success';
};

export function beatBadge(beat: ResolvedBeat): BeatBadge {
  switch (beat.tone) {
    case 'setup':
      return { label: 'Setup', tone: 'neutral' };
    case 'blunder':
      return { label: beat.san ? `Blunder · ${beat.san}` : 'Blunder', tone: 'danger' };
    case 'punishment':
      if (beat.mate) {
        return { label: beat.san ? `Checkmate · ${beat.san}` : 'Checkmate', tone: 'danger' };
      }
      return { label: beat.san ? `Punishment · ${beat.san}` : 'Punishment', tone: 'danger' };
    case 'ok':
      return { label: beat.san ? `Safe move · ${beat.san}` : 'Safe move', tone: 'success' };
    default: {
      const _exhaustive: never = beat.tone;
      return _exhaustive;
    }
  }
}

export function nextBeatCta(
  beats: readonly ResolvedBeat[],
  index: number,
  lastCard: boolean,
  compact = false,
): string {
  if (index >= beats.length - 1) {
    if (lastCard) return compact ? 'Try it' : 'Try it yourself';
    return compact ? 'Next example' : 'Next example';
  }
  const current = beats[index];
  const next = beats[index + 1];
  if (!next) return 'Next step';
  if (next.tone === 'punishment') {
    return next.mate ? 'See checkmate' : 'See what happens';
  }
  if (next.tone === 'blunder') {
    return 'See the blunder';
  }
  if (next.tone === 'ok') {
    return current?.tone === 'ok' ? 'See reply' : 'See the move';
  }
  return 'Next step';
}

/**
 * Setup steps draw amber watch arrows; blunder steps draw a red threat arrow for
 * the upcoming punishment so learners see the danger before the capture lands.
 */
export function arrowsForBeat(
  card: LessonCard,
  beats: readonly ResolvedBeat[],
  index: number,
  scheme: ColorScheme,
  colors: Palette,
): BoardArrow[] {
  const beat = beats[index];
  if (!beat) return [];
  if (beat.tone === 'setup') {
    return (card.arrows ?? []).map((arrow) => ({
      from: arrow.from,
      to: arrow.to,
      color: markColor('warning', scheme, colors),
    }));
  }
  if (beat.tone === 'blunder') {
    const next = beats[index + 1];
    if (next?.tone === 'punishment' && next.lastMove) {
      return [
        {
          from: next.lastMove.from,
          to: next.lastMove.to,
          color: markColor('danger', scheme, colors),
        },
      ];
    }
  }
  if (beat.tone === 'punishment' && beat.lastMove) {
    return [
      {
        from: beat.lastMove.from,
        to: beat.lastMove.to,
        color: markColor('danger', scheme, colors),
      },
    ];
  }
  return [];
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
    case 'counting':
      return 'Count attackers versus defenders, and remember that a cheaper piece attacking a pricier one still wins material.';
    case 'overloaded':
      return 'Before moving a defender to grab material or retreat, check every job it is currently doing.';
    case 'discovered':
      return 'Always scan the diagonals, files, and ranks behind a piece before you step it out of the way.';
    case 'quiet_trap':
      return 'Even normal developing moves and castling can cut off or abandon a key defender. Do one quick scan first.';
    case 'routine':
      return 'Before every move: check their last move, scan loose pieces, check their forcing replies, and verify your move before letting go.';
    case 'opening_traps':
      return 'Count defenders before grabbing early pawns, keep your king safe, and drop opening autopilot the moment your opponent deviates.';
    case 'counterplay':
      return 'Never fall in love with your own attack or recapture on reflex — check your opponent’s sharpest reply first.';
    case 'endgame_safety':
      return 'Fewer pieces raise the stakes. Keep passed pawns defended, put rooks behind them, and give your king air before racing to queen.';
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
  counting: 1,
  overloaded: 2,
  discovered: 3,
  quiet_trap: 4,
  routine: 1,
  opening_traps: 2,
  counterplay: 3,
  endgame_safety: 4,
};

export function lessonTrack(id: LessonId): { label: string; total: number } {
  switch (id) {
    case 'counting':
    case 'overloaded':
    case 'discovered':
    case 'quiet_trap':
      return { label: 'Club', total: 4 };
    case 'routine':
    case 'opening_traps':
    case 'counterplay':
    case 'endgame_safety':
      return { label: 'Habit', total: 4 };
    default:
      return { label: 'Lesson', total: 6 };
  }
}

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
