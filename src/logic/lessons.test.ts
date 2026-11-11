import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { isAbsolutePin, isLiveForkOn } from '@/src/logic/danger';
import { isCorrectDrillMove } from '@/src/logic/drills';
import {
  LESSONS,
  learnCard,
  lessonById,
  nextLessonId,
  practiceHref,
  resolveBeats,
  withLessonComplete,
  type LessonBeat,
  type LessonCard,
} from '@/src/logic/lessons';
import {
  hangingGain,
  materialIsReachable,
  moveOutcome,
  opponentThreatensMateInOne,
} from '@/src/logic/safety';

const ORDER = ['blunder', 'hanging', 'fork', 'pin', 'back_rank', 'mate'] as const;

function fenBefore(card: LessonCard, index: number): string {
  const game = new Chess(card.fen);
  for (let i = 0; i < index; i += 1) {
    const uci = card.beats[i]?.uci;
    if (!uci) continue;
    game.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: 'q' });
  }
  return game.fen();
}

function outcomeAt(card: LessonCard, index: number, beat: LessonBeat): number | null {
  const uci = beat.uci;
  if (!uci) return null;
  const side = new Chess(fenBefore(card, index)).turn();
  return moveOutcome(fenBefore(card, index), uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, side);
}

function withTurn(fen: string, turn: 'w' | 'b'): string {
  const parts = fen.split(' ');
  parts[1] = turn;
  parts[3] = '-';
  return new Chess(parts.join(' ')).fen();
}

describe('lesson course', () => {
  it('lists six unlocked lessons in the suggested order', () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual([...ORDER]);
    for (const lesson of LESSONS) {
      expect(lesson.cards.length).toBeGreaterThanOrEqual(2);
      expect(lesson.tries.length).toBeGreaterThanOrEqual(2);
      expect(lesson.tries.length).toBeLessThanOrEqual(3);
    }
  });

  it('plays every example and matches the tactic the copy describes', () => {
    for (const lesson of LESSONS) {
      for (const card of lesson.cards) {
        expect(materialIsReachable(card.fen), card.id).toBe(true);
        const start = new Chess(card.fen);
        expect(start.isCheck(), card.id).toBe(Boolean(card.inCheck));
        const beats = resolveBeats(card.fen, card.beats);
        expect(beats.map((beat) => beat.tone), card.id).toEqual(card.beats.map((beat) => beat.tone));

        card.beats.forEach((beat, index) => {
          const score = outcomeAt(card, index, beat);
          if (beat.tone === 'blunder') expect(score, `${card.id} blunder`).toBeLessThan(0);
          if (beat.tone === 'ok') expect(score, `${card.id} ok`).toBeGreaterThanOrEqual(0);
          if (beat.tone === 'punishment') {
            const shown = beats[index];
            expect(shown?.captured || shown?.mate, `${card.id} punishment`).toBe(true);
          }
        });

        if (card.id === 'blunder-material') {
          expect(beats.at(-1)?.captured).toBe(true);
          expect(beats.at(-1)?.san).toBe('Nxd5');
        }
        if (card.id === 'blunder-trade') {
          expect(outcomeAt(card, 1, card.beats[1]!), card.id).toBe(0);
          expect(beats.at(-1)?.san).toBe('Kxe7');
        }
        if (card.id === 'blunder-mate' || card.id === 'mate-fool' || card.id === 'mate-scholar' || card.id === 'back-mate') {
          expect(beats.at(-1)?.mate, card.id).toBe(true);
          expect(outcomeAt(card, 1, card.beats[1]!), `${card.id} blunder`).toBe(-100);
        }
        if (card.id === 'hanging-queen') {
          expect(hangingGain(card.fen, 'h5', 'w')).toBeGreaterThan(0);
          expect(beats.at(-1)?.san).toBe('Nxh5');
        }
        if (card.id === 'hanging-rook') {
          expect(hangingGain(card.fen, 'a1', 'w')).toBeGreaterThan(0);
          expect(beats.at(-1)?.san).toBe('Bxa1');
        }
        if (card.id === 'fork-quiet' || card.id === 'fork-check') {
          const square = card.id === 'fork-quiet' ? 'd1' : 'a1';
          expect(isLiveForkOn(start, square as Square, 'w'), card.id).toBe(true);
        }
        if (card.id === 'pin-bishop') {
          expect(isAbsolutePin(start, 'c3', 'w')).toBe(true);
          expect(start.moves({ square: 'c3' })).toHaveLength(0);
        }
        if (card.id === 'pin-rook') {
          expect(isAbsolutePin(start, 'e6', 'b')).toBe(true);
        }
        if (card.id === 'back-luft') {
          expect(beats.at(-1)?.mate).toBe(false);
          expect(beats.at(-1)?.san).toBe('Kh2');
        }
      }
    }
  });

  it('judges every guided try with the drill rules', () => {
    for (const lesson of LESSONS) {
      for (const task of lesson.tries) {
        const { drill } = task;
        expect(materialIsReachable(drill.fen), drill.id).toBe(true);
        expect(new Chess(drill.fen).turn(), drill.id).toBe(drill.sideToMove);
        const game = new Chess(drill.fen);
        for (const uci of drill.solution) {
          expect(
            isCorrectDrillMove(drill, uci.slice(0, 2) as Square, uci.slice(2, 4) as Square),
            `${drill.id} ${uci}`,
          ).toBe(true);
        }
        expect(
          isCorrectDrillMove(drill, task.blunder.slice(0, 2) as Square, task.blunder.slice(2, 4) as Square),
          `${drill.id} blunder`,
        ).toBe(false);

        switch (task.kind) {
          case 'even':
            expect(
              moveOutcome(drill.fen, drill.solution[0]!.slice(0, 2) as Square, drill.solution[0]!.slice(2, 4) as Square, drill.sideToMove),
              drill.id,
            ).toBe(0);
            break;
          case 'hanging':
            expect(hangingGain(drill.fen, drill.atRiskSquare, drill.sideToMove), drill.id).toBeGreaterThan(0);
            break;
          case 'fork':
            expect(isLiveForkOn(game, drill.atRiskSquare, drill.sideToMove), drill.id).toBe(true);
            break;
          case 'pin':
            expect(isAbsolutePin(game, drill.atRiskSquare, drill.sideToMove), drill.id).toBe(true);
            break;
          case 'back_rank':
            expect(
              moveOutcome(
                drill.fen,
                task.blunder.slice(0, 2) as Square,
                task.blunder.slice(2, 4) as Square,
                drill.sideToMove,
              ),
              drill.id,
            ).toBe(-100);
            break;
          case 'missed_mate': {
            const opponent = drill.sideToMove === 'w' ? 'b' : 'w';
            expect(opponentThreatensMateInOne(withTurn(drill.fen, opponent)), drill.id).toBe(true);
            break;
          }
          default: {
            const _exhaustive: never = task.kind;
            throw new Error(_exhaustive);
          }
        }
      }
    }
  });
});

describe('lesson completion', () => {
  it('continues at the next unfinished lesson and returns to the list when all are done', () => {
    expect(nextLessonId([])).toBe('blunder');
    expect(nextLessonId(['fork'])).toBe('blunder');
    expect(nextLessonId(['blunder', 'hanging'])).toBe('fork');
    expect(withLessonComplete(['blunder'], 'blunder')).toEqual(['blunder']);
    expect(withLessonComplete(['blunder'], 'fork')).toEqual(['blunder', 'fork']);

    expect(learnCard([])).toEqual({
      href: '/learn?lesson=blunder',
      title: 'Learn',
      body: "Start: What's a blunder?",
    });
    expect(learnCard(['blunder']).href).toBe('/learn?lesson=hanging');
    expect(learnCard(['blunder']).body).toBe('Continue: Hanging pieces');
    expect(learnCard([...ORDER])).toEqual({
      href: '/learn',
      title: 'Learn',
      body: 'All six lessons done. Review any idea.',
    });
    expect(nextLessonId([...ORDER])).toBeNull();
  });

  it('practices the lesson theme in guided Play', () => {
    expect(practiceHref(lessonById('blunder'))).toBe('/drills');
    expect(practiceHref(lessonById('fork'))).toBe('/drills?theme=fork');
    expect(practiceHref(lessonById('mate'))).toBe('/drills?theme=missed_mate');
  });
});
