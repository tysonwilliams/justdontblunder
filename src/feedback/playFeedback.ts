import { createAudioPlayer, preload, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { cuesForCommittedMove, planFeedback, type FeedbackCue, type HapticId, type SoundId } from '@/src/feedback/cues';
import { primeSilently, replayAudibly } from '@/src/feedback/playback';
import { useFeedbackSettings } from '@/src/store/feedbackSettings';

const sources: Record<SoundId, number> = {
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  save: require('../../assets/sounds/save.wav'),
  blunder: require('../../assets/sounds/blunder.wav'),
};

for (const source of Object.values(sources)) {
  void preload(source);
}

let players: Record<SoundId, AudioPlayer> | null = null;
let unlocked = false;
let lastBlunderAt = 0;

function getPlayers(): Record<SoundId, AudioPlayer> {
  if (!players) {
    players = {
      move: createAudioPlayer(sources.move),
      capture: createAudioPlayer(sources.capture),
      save: createAudioPlayer(sources.save),
      blunder: createAudioPlayer(sources.blunder),
    };
  }
  return players;
}

function replay(player: AudioPlayer, volume: number): void {
  replayAudibly(player, volume);
}

function fireHaptic(kind: HapticId): void {
  if (Platform.OS === 'web') return;
  const run = () => {
    switch (kind) {
      case 'selection':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      case 'success':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  };
  void Promise.resolve(run()).catch(() => undefined);
}

/**
 * Browsers only allow audio after a gesture. A drag ends outside that gesture,
 * so the pointer-down primes each clip silently.
 */
export function unlockFeedback(): void {
  if (unlocked) return;
  unlocked = true;
  for (const player of Object.values(getPlayers())) {
    primeSilently(player);
  }
}

/** Click for the move itself, then the save or blunder chime when the trainer has a verdict. */
export function playMoveOutcome(san: string, allowed: boolean | void): void {
  for (const cue of cuesForCommittedMove(san, allowed)) {
    playFeedback(cue);
  }
}

/** The only place move sounds and haptics are triggered. */
export function playFeedback(cue: FeedbackCue): void {
  if (cue === 'blunder') {
    const now = Date.now();
    if (now - lastBlunderAt < 80) return;
    lastBlunderAt = now;
  }
  const settings = useFeedbackSettings.getState();
  const plan = planFeedback(cue, {
    sound: settings.sound,
    haptics: settings.haptics,
    native: Platform.OS === 'ios' || Platform.OS === 'android',
  });
  if (plan.sound) replay(getPlayers()[plan.sound], 1);
  if (plan.haptic) fireHaptic(plan.haptic);
}
