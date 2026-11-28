import { cuesForCommittedMove, planFeedback, type FeedbackCue, type SoundId } from '@/src/feedback/cues';
import { useFeedbackSettings } from '@/src/store/feedbackSettings';

type WebAudioContext = AudioContext;

let audioCtx: WebAudioContext | null = null;
let lastBlunderAt = 0;

function audioContextCtor(): (new () => WebAudioContext) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: new () => WebAudioContext;
    webkitAudioContext?: new () => WebAudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function ensureContext(): WebAudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/**
 * Unlocks Web Audio on the first real user gesture (touchend/pointerup/click/keydown)
 * only when sound is enabled. Retries naturally if Safari leaves the context suspended.
 */
export function unlockFeedback(): void {
  if (!useFeedbackSettings.getState().sound) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'running') return;
  try {
    void ctx.resume().catch(() => undefined);
  } catch {
    // Ignore restricted autoplay contexts until the next gesture.
  }
}

function tone(
  ctx: WebAudioContext,
  type: OscillatorType,
  startFreq: number,
  endFreq: number,
  delaySec: number,
  durationSec: number,
  peakGain: number,
): void {
  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.015);
}

function playSynth(sound: SoundId): void {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state !== 'running') {
    try {
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') emitSound(ctx, sound);
        })
        .catch(() => undefined);
    } catch {
      // Autoplay blocked before gesture.
    }
    return;
  }
  emitSound(ctx, sound);
}

function emitSound(ctx: WebAudioContext, sound: SoundId): void {
  switch (sound) {
    case 'move':
      // Crisp, warm wooden piece tap.
      tone(ctx, 'triangle', 260, 125, 0, 0.055, 0.22);
      tone(ctx, 'sine', 520, 220, 0, 0.03, 0.08);
      break;
    case 'capture':
      // Slightly sharper double-knock for a capture.
      tone(ctx, 'triangle', 340, 140, 0, 0.065, 0.26);
      tone(ctx, 'sine', 680, 240, 0.012, 0.045, 0.14);
      break;
    case 'save':
      // Calm ascending fifth chime.
      tone(ctx, 'sine', 523.25, 523.25, 0.02, 0.13, 0.12);
      tone(ctx, 'sine', 783.99, 783.99, 0.09, 0.19, 0.14);
      break;
    case 'blunder':
      // Muted low descending thud.
      tone(ctx, 'triangle', 195, 118, 0.02, 0.19, 0.2);
      tone(ctx, 'sine', 148, 96, 0.09, 0.18, 0.16);
      break;
    default: {
      const _exhaustive: never = sound;
      return _exhaustive;
    }
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
    haptics: false,
    native: false,
  });
  if (plan.sound) playSynth(plan.sound);
}
