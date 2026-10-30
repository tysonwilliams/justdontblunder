import { createAudioPlayer, preload, type AudioPlayer } from 'expo-audio';

import { type MoveSound } from '@/src/audio/moveSound';

const sources: Record<MoveSound, number> = {
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  fail: require('../../assets/sounds/fail.wav'),
};

for (const source of Object.values(sources)) {
  void preload(source);
}

let players: Record<MoveSound, AudioPlayer> | null = null;
let unlocked = false;
let lastFailAt = 0;

function getPlayers(): Record<MoveSound, AudioPlayer> {
  if (!players) {
    players = {
      move: createAudioPlayer(sources.move),
      capture: createAudioPlayer(sources.capture),
      fail: createAudioPlayer(sources.fail),
    };
  }
  return players;
}

function replay(player: AudioPlayer, volume: number): void {
  player.volume = volume;
  void player.seekTo(0);
  player.play();
}

/**
 * Browsers only allow audio after a gesture. A drag ends outside that gesture,
 * so the pointer-down primes each clip silently.
 */
export function unlockMoveSounds(): void {
  if (unlocked) return;
  unlocked = true;
  for (const player of Object.values(getPlayers())) {
    replay(player, 0);
  }
}

export function playMoveSound(kind: MoveSound): void {
  if (kind === 'fail') {
    // A click can also finish a drag, which would play this twice.
    const now = Date.now();
    if (now - lastFailAt < 80) return;
    lastFailAt = now;
  }
  replay(getPlayers()[kind], 1);
}
