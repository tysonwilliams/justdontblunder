import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The short low tones shipped with the feedback pass were easy to miss on
 * laptop and phone speakers. Move and capture need a loud attack and energy
 * above 1 kHz so the click still reads after the save or blunder chime.
 */
describe('move and capture clips', () => {
  it('keeps a bright attack on the move click', () => {
    expect(audibility(resolveClip('move.wav'))).toEqual({
      audibleAttack: true,
      bright: true,
    });
  });

  it('keeps a bright attack on the capture click', () => {
    expect(audibility(resolveClip('capture.wav'))).toEqual({
      audibleAttack: true,
      bright: true,
    });
  });
});

function resolveClip(name: string): string {
  return path.join(__dirname, '../../assets/sounds', name);
}

function audibility(file: string): { audibleAttack: boolean; bright: boolean } {
  const { samples, rate } = readPcm(file);
  const attack = samples.slice(0, Math.floor(rate * 0.008));
  const peak = attack.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  return {
    audibleAttack: peak >= 0.7 && samples.length / rate >= 0.06 && samples.length / rate <= 0.15,
    bright: highpassRatio(samples, rate) >= 0.25,
  };
}

function highpassRatio(samples: number[], rate: number): number {
  const rc = 1 / (2 * Math.PI * 1000);
  const alpha = rc / (rc + 1 / rate);
  let previousOut = 0;
  let previousIn = samples[0] ?? 0;
  let high = 0;
  let all = 0;
  for (const sample of samples) {
    const output = alpha * (previousOut + sample - previousIn);
    previousOut = output;
    previousIn = sample;
    high += output * output;
    all += sample * sample;
  }
  return all === 0 ? 0 : high / all;
}

function readPcm(file: string): { samples: number[]; rate: number } {
  const buffer = readFileSync(file);
  const rate = buffer.readUInt32LE(24);
  const data = dataChunk(buffer);
  const samples: number[] = [];
  for (let offset = 0; offset + 1 < data.length; offset += 2) {
    samples.push(data.readInt16LE(offset) / 32768);
  }
  return { samples, rate };
}

function dataChunk(buffer: Buffer): Buffer {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'data') return buffer.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  throw new Error('wav data chunk missing');
}
