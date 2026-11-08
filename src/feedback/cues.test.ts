import { describe, expect, it } from 'vitest';

import { cueForLessonTone, planFeedback, type FeedbackCue } from '@/src/feedback/cues';

const BOTH = { sound: true, haptics: true, native: true };

describe('planFeedback', () => {
  it('maps each cue to one sound and the matching haptic', () => {
    expect(planFeedback('pickup', BOTH)).toEqual({ sound: null, haptic: 'selection' });
    expect(planFeedback('drop', BOTH)).toEqual({ sound: null, haptic: 'selection' });
    expect(planFeedback('move', BOTH)).toEqual({ sound: 'move', haptic: null });
    expect(planFeedback('capture', BOTH)).toEqual({ sound: 'capture', haptic: null });
    expect(planFeedback('save', BOTH)).toEqual({ sound: 'save', haptic: 'success' });
    expect(planFeedback('blunder', BOTH)).toEqual({ sound: 'blunder', haptic: 'error' });
  });

  it('drops sound when sound is off and keeps haptics', () => {
    const cues: FeedbackCue[] = ['pickup', 'drop', 'move', 'capture', 'save', 'blunder'];
    for (const cue of cues) {
      const plan = planFeedback(cue, { sound: false, haptics: true, native: true });
      expect(plan.sound).toBeNull();
      expect(plan.haptic).toBe(planFeedback(cue, BOTH).haptic);
    }
  });

  it('drops haptics when haptics are off and keeps sound', () => {
    const cues: FeedbackCue[] = ['pickup', 'drop', 'move', 'capture', 'save', 'blunder'];
    for (const cue of cues) {
      const plan = planFeedback(cue, { sound: true, haptics: false, native: true });
      expect(plan.haptic).toBeNull();
      expect(plan.sound).toBe(planFeedback(cue, BOTH).sound);
    }
  });

  it('never haptics on web, even when the toggle is on', () => {
    const cues: FeedbackCue[] = ['pickup', 'drop', 'save', 'blunder'];
    for (const cue of cues) {
      expect(planFeedback(cue, { sound: true, haptics: true, native: false }).haptic).toBeNull();
    }
    expect(planFeedback('save', { sound: true, haptics: true, native: false }).sound).toBe('save');
  });

  it('stays silent when both toggles are off', () => {
    expect(planFeedback('blunder', { sound: false, haptics: false, native: true })).toEqual({
      sound: null,
      haptic: null,
    });
  });
});

describe('cueForLessonTone', () => {
  it('uses save for the safe idea and blunder for the miss', () => {
    expect(cueForLessonTone('ok', 'e4')).toBe('save');
    expect(cueForLessonTone('blunder', 'Qh5+')).toBe('blunder');
    expect(cueForLessonTone('punishment', 'Qxf7')).toBe('capture');
    expect(cueForLessonTone('setup', 'e4')).toBe('move');
  });
});
