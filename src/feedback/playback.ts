/**
 * Web audio will not start until a gesture plays each element. The prime
 * must be silent, and it must not leave the element at volume 0: a later
 * move would then be inaudible. Mute the prime instead of turning volume
 * down, and let a real cue cancel the prime so it cannot pause that cue.
 */
export type FeedbackPlayer = {
  volume: number;
  muted: boolean;
  /** Seconds. Missing means the clip has not been moved off the start. */
  currentTime?: number;
  seekTo(seconds: number): Promise<void> | void;
  play(): void;
  pause(): void;
};

const generation = new WeakMap<FeedbackPlayer, number>();

/** Long enough for the gesture's play() to be accepted, short of an audible tail. */
export const PRIME_MS = 60;

function bump(player: FeedbackPlayer): number {
  const next = (generation.get(player) ?? 0) + 1;
  generation.set(player, next);
  return next;
}

export function primeSilently(player: FeedbackPlayer): void {
  const token = bump(player);
  player.volume = 1;
  player.muted = true;
  void player.seekTo(0);
  player.play();
  setTimeout(() => {
    if (generation.get(player) !== token) return;
    player.pause();
    void player.seekTo(0);
    player.volume = 1;
    player.muted = false;
  }, PRIME_MS);
}

const START_SECONDS = 0.005;

/**
 * A short click lives in the first few milliseconds. Calling play() while a
 * seek back to 0 is still pending starts at the old playhead — often the
 * quiet tail — and the attack never sounds.
 */
export function replayAudibly(player: FeedbackPlayer, volume: number): void {
  const token = bump(player);
  player.muted = false;
  player.volume = volume;
  if ((player.currentTime ?? 0) <= START_SECONDS) {
    player.play();
    return;
  }
  player.pause();
  void Promise.resolve(player.seekTo(0)).then(() => {
    playWhenReady(player, token, volume, 0);
  });
}

function playWhenReady(player: FeedbackPlayer, token: number, volume: number, tries: number): void {
  if (generation.get(player) !== token) return;
  if ((player.currentTime ?? 0) <= START_SECONDS || tries >= 8) {
    player.muted = false;
    player.volume = volume;
    player.play();
    return;
  }
  setTimeout(() => playWhenReady(player, token, volume, tries + 1), 10);
}
