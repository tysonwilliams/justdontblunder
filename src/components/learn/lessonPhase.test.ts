import { describe, expect, it } from 'vitest';

import {
  arrowsForBeat,
  beatBadge,
  lessonProgress,
  lessonSteps,
  nextBeatCta,
  nextPhase,
  prevPhase,
  readingDelayMs,
} from '@/src/components/learn/lessonPhase';
import { ALL_LESSONS, lessonById, resolveBeats } from '@/src/logic/lessons';
import { palettes } from '@/src/theme/tokens';

describe('lesson pacing and step UX', () => {
  it('scales auto-play reading delay calmly with explanation length', () => {
    const shortDelay = readingDelayMs('She goes to d5.');
    const mediumDelay = readingDelayMs(
      'The knight attacks d5. Your queen can step there, and nothing defends that square.',
    );
    const longDelay = readingDelayMs(
      'Count is one attacker versus one defender, since your king defends e2. Value still matters: a bishop attacking a rook wins the exchange.',
    );

    expect(shortDelay).toBeGreaterThanOrEqual(3200);
    expect(mediumDelay).toBeGreaterThan(shortDelay);
    expect(longDelay).toBeLessThanOrEqual(5500);
    expect(longDelay).toBeGreaterThanOrEqual(mediumDelay);
  });

  it('builds clear tone badges and contextual next-step labels', () => {
    const blunder = lessonById('blunder');
    const freePiece = resolveBeats(blunder.cards[0]!.fen, blunder.cards[0]!.beats);
    const trade = resolveBeats(blunder.cards[1]!.fen, blunder.cards[1]!.beats);
    const mate = resolveBeats(blunder.cards[2]!.fen, blunder.cards[2]!.beats);

    expect(beatBadge(freePiece[0]!)).toEqual({ label: 'Setup', tone: 'neutral' });
    expect(beatBadge(freePiece[1]!)).toEqual({ label: 'Blunder · Qd5', tone: 'danger' });
    expect(beatBadge(freePiece[2]!)).toEqual({ label: 'Punishment · Nxd5', tone: 'danger' });
    expect(beatBadge(trade[1]!)).toEqual({ label: 'Safe move · Qxe7+', tone: 'success' });
    expect(beatBadge(mate[2]!)).toEqual({ label: 'Checkmate · Qh4#', tone: 'danger' });

    expect(nextBeatCta(freePiece, 0, false)).toBe('See the blunder');
    expect(nextBeatCta(freePiece, 1, false)).toBe('See what happens');
    expect(nextBeatCta(freePiece, 2, false)).toBe('Next example');
    expect(nextBeatCta(mate, 1, true)).toBe('See checkmate');
    expect(nextBeatCta(mate, 2, true, false)).toBe('Try it yourself');
    expect(nextBeatCta(mate, 2, true, true)).toBe('Try it');
    expect(nextBeatCta(trade, 0, false)).toBe('See the move');
    expect(nextBeatCta(trade, 1, false)).toBe('See reply');
  });

  it('draws setup arrows on Step 1 and red threat arrows on blunder steps across all lessons', () => {
    for (const lesson of ALL_LESSONS) {
      for (const card of lesson.cards) {
        const beats = resolveBeats(card.fen, card.beats);
        const setupArrows = arrowsForBeat(card, beats, 0, 'dark', palettes.dark);
        expect(setupArrows.length, `${card.id} setup arrow`).toBeGreaterThan(0);

        beats.forEach((beat, index) => {
          if (beat.tone === 'blunder' && beats[index + 1]?.tone === 'punishment') {
            const threatArrows = arrowsForBeat(card, beats, index, 'dark', palettes.dark);
            expect(threatArrows, `${card.id} blunder threat arrow`).toHaveLength(1);
            expect(threatArrows[0]?.from).toBe(beats[index + 1]?.lastMove?.from);
            expect(threatArrows[0]?.to).toBe(beats[index + 1]?.lastMove?.to);
          }
        });
      }
    }
  });

  it('navigates forward and backward across examples and tries with smooth step progress', () => {
    const lesson = lessonById('blunder');
    expect(lessonSteps(lesson).map((slot) => slot.shortLabel)).toEqual([
      'Ex 1',
      'Ex 2',
      'Ex 3',
      'Try 1',
      'Try 2',
      'Try 3',
    ]);

    expect(prevPhase(lesson, { kind: 'card', index: 0 })).toBeNull();
    expect(prevPhase(lesson, { kind: 'card', index: 1 })).toEqual({ kind: 'card', index: 0 });
    expect(prevPhase(lesson, { kind: 'try', index: 0 })).toEqual({ kind: 'card', index: 2 });
    expect(prevPhase(lesson, { kind: 'try', index: 2 })).toEqual({ kind: 'try', index: 1 });
    expect(nextPhase(lesson, { kind: 'card', index: 2 })).toEqual({ kind: 'try', index: 0 });
    expect(nextPhase(lesson, { kind: 'try', index: 2 })).toEqual({ kind: 'done' });

    const pStep1 = lessonProgress(lesson, { kind: 'card', index: 0 }, 0.5 / 3);
    const pStep2 = lessonProgress(lesson, { kind: 'card', index: 0 }, 1.5 / 3);
    const pStep3 = lessonProgress(lesson, { kind: 'card', index: 0 }, 2.5 / 3);
    const pCard2 = lessonProgress(lesson, { kind: 'card', index: 1 }, 0.5 / 3);
    expect(pStep1).toBeGreaterThan(0);
    expect(pStep2).toBeGreaterThan(pStep1);
    expect(pStep3).toBeGreaterThan(pStep2);
    expect(pCard2).toBeGreaterThan(pStep3);
    expect(lessonProgress(lesson, { kind: 'done' })).toBe(1);
  });
});
