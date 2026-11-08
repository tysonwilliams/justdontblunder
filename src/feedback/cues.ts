import { soundForSan } from '@/src/audio/moveSound';

/** One trainer event. The player turns this into at most one sound and one haptic. */
export type FeedbackCue = 'pickup' | 'drop' | 'move' | 'capture' | 'save' | 'blunder';

export type SoundId = 'move' | 'capture' | 'save' | 'blunder';

export type HapticId = 'selection' | 'success' | 'error';

export type FeedbackPlan = {
  sound: SoundId | null;
  haptic: HapticId | null;
};

export function planFeedback(
  cue: FeedbackCue,
  options: { sound: boolean; haptics: boolean; native: boolean },
): FeedbackPlan {
  return {
    sound: options.sound ? soundForCue(cue) : null,
    haptic: options.haptics && options.native ? hapticForCue(cue) : null,
  };
}

/** Lesson demos: the safe idea uses the save chime, a blunder the fail chime. */
export function cueForLessonTone(tone: string, san: string): FeedbackCue {
  if (tone === 'blunder') return 'blunder';
  if (tone === 'ok') return 'save';
  return soundForSan(san);
}

function soundForCue(cue: FeedbackCue): SoundId | null {
  switch (cue) {
    case 'pickup':
    case 'drop':
      return null;
    case 'move':
      return 'move';
    case 'capture':
      return 'capture';
    case 'save':
      return 'save';
    case 'blunder':
      return 'blunder';
    default: {
      const _exhaustive: never = cue;
      return _exhaustive;
    }
  }
}

function hapticForCue(cue: FeedbackCue): HapticId | null {
  switch (cue) {
    case 'pickup':
    case 'drop':
      return 'selection';
    case 'move':
    case 'capture':
      return null;
    case 'save':
      return 'success';
    case 'blunder':
      return 'error';
    default: {
      const _exhaustive: never = cue;
      return _exhaustive;
    }
  }
}
