import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  HOME_HANGING_PROMPT,
  createDailySession,
  createHomeSession,
  getAllDrills,
  homePlayPrompt,
} from '@/src/logic/drills';

describe('home session', () => {
  it('keeps today’s drills and leads with a white hanging save when one is in the set', () => {
    const date = new Date('2026-10-31T12:00:00Z');
    const daily = createDailySession(date);
    const home = createHomeSession(date);
    expect(home.positions.map((drill) => drill.id).sort()).toEqual(
      daily.positions.map((drill) => drill.id).sort(),
    );
    const whiteHanging = daily.positions.filter(
      (drill) => drill.theme === 'hanging' && drill.sideToMove === 'w',
    );
    expect(whiteHanging.length).toBeGreaterThan(0);
    expect(
      home.positions
        .slice(0, whiteHanging.length)
        .every((drill) => drill.theme === 'hanging' && drill.sideToMove === 'w'),
    ).toBe(true);
    expect(homePlayPrompt(home.positions[0]!)).toBe(HOME_HANGING_PROMPT);
  });

  it('uses the plain hanging line and never the luft tip', () => {
    for (const drill of getAllDrills()) {
      const prompt = homePlayPrompt(drill);
      expect(prompt).not.toMatch(/Luft/i);
      if (drill.theme === 'hanging') expect(prompt).toBe(HOME_HANGING_PROMPT);
    }
    const drills = readFileSync(new URL('./drills.ts', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../components/HomeTrainer.tsx', import.meta.url), 'utf8');
    expect(drills).not.toMatch(/Luft/);
    expect(home).not.toMatch(/Luft/);
  });
});
