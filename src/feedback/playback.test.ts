import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRIME_MS, primeSilently, replayAudibly, type FeedbackPlayer } from '@/src/feedback/playback';
import { DEFAULT_FEEDBACK } from '@/src/feedback/settings';

function fakePlayer(): FeedbackPlayer & { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } {
  const player: FeedbackPlayer & { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } = {
    volume: 1,
    muted: false,
    currentTime: 0,
    seekTo: vi.fn(() => Promise.resolve()),
    play: vi.fn(),
    pause: vi.fn(),
  };
  return player;
}

describe('feedback playback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with sound on', () => {
    expect(DEFAULT_FEEDBACK.sound).toBe(true);
  });

  it('does not leave a player muted or at volume 0 after the silent unlock', () => {
    const player = fakePlayer();
    player.volume = 0;
    player.muted = false;

    primeSilently(player);

    expect(player.volume).toBe(1);
    expect(player.muted).toBe(true);
    expect(player.play).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(PRIME_MS);

    expect(player.volume).toBe(1);
    expect(player.muted).toBe(false);
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('plays a later cue at full volume even if unlock had muted the element', () => {
    const player = fakePlayer();
    primeSilently(player);
    replayAudibly(player, 1);
    vi.advanceTimersByTime(PRIME_MS);

    expect(player.volume).toBe(1);
    expect(player.muted).toBe(false);
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it('does not play a short clip from the tail while the seek back to zero is still pending', async () => {
    const player = fakePlayer();
    player.currentTime = 0.09;
    let finishSeek = () => {};
    player.seekTo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSeek = () => {
            player.currentTime = 0;
            resolve();
          };
        }),
    );

    replayAudibly(player, 1);
    await Promise.resolve();

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.volume).toBe(1);
    expect(player.muted).toBe(false);

    finishSeek();
    await Promise.resolve();
    await Promise.resolve();

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.currentTime).toBe(0);
  });
});
