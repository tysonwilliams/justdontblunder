import { describe, expect, it } from 'vitest';

import {
  BLUNDER_TRIGGERS,
  PRE_MOVE_STEPS,
  TIME_TROUBLE_CHECK,
  TRAINING_WEEKS,
} from '@/src/logic/antiBlunderGuide';
import { lessonById, parseLessonId } from '@/src/logic/lessons';

describe('anti-blunder guide', () => {
  it('provides a complete 4-step pre-move routine and blitz mini-check', () => {
    expect(PRE_MOVE_STEPS).toHaveLength(4);
    expect(PRE_MOVE_STEPS.map((s) => s.number)).toEqual(['1', '2', '3', '4']);
    for (const step of PRE_MOVE_STEPS) {
      expect(step.title.length).toBeGreaterThan(4);
      expect(step.detail.length).toBeGreaterThan(10);
    }
    expect(TIME_TROUBLE_CHECK.summary).toContain('Threat');
    expect(BLUNDER_TRIGGERS.length).toBeGreaterThanOrEqual(4);
  });

  it('maps every week of the 4-week plan to a valid lesson and route', () => {
    expect(TRAINING_WEEKS).toHaveLength(4);
    expect(TRAINING_WEEKS.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    for (const stage of TRAINING_WEEKS) {
      expect(parseLessonId(stage.lessonId)).toBe(stage.lessonId);
      expect(lessonById(stage.lessonId).title).toBe(stage.lessonLabel);
      expect(stage.actionHref.startsWith('/')).toBe(true);
    }
  });
});
