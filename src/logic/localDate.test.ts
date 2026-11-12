import { afterEach, describe, expect, it } from 'vitest';

import { createDailySession, createHomeSession } from '@/src/logic/drills';
import { localDateKey, previousLocalDateKey } from '@/src/logic/localDate';

const previousTz = process.env.TZ;

afterEach(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

describe('local calendar dates', () => {
  it('keeps the local evening when UTC has already moved to the next day', () => {
    process.env.TZ = 'America/Denver';
    const afternoon = new Date('2026-11-12T23:30:00.000Z');
    const evening = new Date('2026-11-13T00:30:00.000Z');
    const nextMorning = new Date('2026-11-13T07:30:00.000Z');

    expect(afternoon.toISOString().slice(0, 10)).toBe('2026-11-12');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(localDateKey(afternoon)).toBe('2026-11-12');
    expect(localDateKey(evening)).toBe('2026-11-12');
    expect(previousLocalDateKey(evening)).toBe('2026-11-11');
    expect(localDateKey(nextMorning)).toBe('2026-11-13');

    expect(createDailySession(evening).id).toBe('daily-2026-11-12');
    expect(createDailySession(afternoon).id).toBe(createDailySession(evening).id);
    expect(createHomeSession(evening).positions.map((drill) => drill.id)).toEqual(
      createHomeSession(afternoon).positions.map((drill) => drill.id),
    );
    expect(createDailySession(nextMorning).id).toBe('daily-2026-11-13');
  });

  it('keeps a daylight-time evening on the local date', () => {
    process.env.TZ = 'America/Denver';
    const evening = new Date('2026-07-16T00:30:00.000Z');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-07-16');
    expect(localDateKey(evening)).toBe('2026-07-15');
    expect(previousLocalDateKey(evening)).toBe('2026-07-14');
  });

  it('steps back across month and year boundaries', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(previousLocalDateKey(new Date(2026, 2, 1, 12))).toBe('2026-02-28');
    expect(previousLocalDateKey(new Date(2026, 0, 1, 0, 30))).toBe('2025-12-31');
  });
});
