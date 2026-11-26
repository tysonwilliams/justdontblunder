import { describe, expect, it } from 'vitest';

import { addLocalDays } from '@/src/logic/localDate';
import {
  INTERVAL_PACK,
  MAX_SAVES,
  advanceSchedule,
  dueNow,
  dueTodayCount,
  dueTodayLabel,
  lapseSchedule,
  moreConservative,
  orderForReview,
  packIntervalDays,
  scheduleFromSaved,
  scheduleFromStored,
} from '@/src/logic/reviewSchedule';

const TODAY = '2026-11-26';

describe('review schedule', () => {
  it('starts a miss due today and schedules 1, 3, 7, 16, then 35 days', () => {
    let schedule = lapseSchedule(TODAY);
    expect(schedule).toEqual({ saves: 0, intervalDays: 0, dueOn: TODAY });
    expect(dueTodayCount([schedule], TODAY)).toBe(1);

    const gaps: number[] = [];
    const dues: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      schedule = advanceSchedule(schedule, TODAY);
      gaps.push(schedule.intervalDays);
      dues.push(schedule.dueOn);
    }
    expect(gaps).toEqual([1, 3, 7, 16, 35, 35]);
    expect(dues).toEqual([1, 3, 7, 16, 35, 35].map((days) => addLocalDays(TODAY, days)));
    expect(dueTodayCount([schedule], TODAY)).toBe(0);
    expect(schedule.saves).toBe(6);
  });

  it('resets a long card to the short box, so the next save is one day', () => {
    const mature = advanceSchedule(
      advanceSchedule(advanceSchedule(advanceSchedule(dueNow(TODAY), TODAY), TODAY), TODAY),
      TODAY,
    );
    expect(mature.intervalDays).toBe(16);
    const missed = lapseSchedule(TODAY);
    expect(missed).toEqual(dueNow(TODAY));
    const again = advanceSchedule(missed, TODAY);
    expect(again).toEqual({ saves: 1, intervalDays: 1, dueOn: addLocalDays(TODAY, 1) });
  });

  it('crosses month and year boundaries on the calendar', () => {
    expect(addLocalDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addLocalDays('2026-12-30', 7)).toBe('2027-01-06');
    expect(advanceSchedule({ saves: 0, intervalDays: 0, dueOn: '2026-12-31' }, '2026-12-31').dueOn).toBe('2027-01-01');
  });

  it('keeps the earlier due date, and the shorter gap when the dates match', () => {
    const soon = { saves: 1, intervalDays: 1, dueOn: '2026-12-01' };
    const later = { saves: 4, intervalDays: 16, dueOn: '2027-02-01' };
    expect(moreConservative(later, soon)).toEqual(soon);
    expect(moreConservative(soon, later)).toEqual(soon);
    const shortGap = { saves: 2, intervalDays: 3, dueOn: '2026-12-01' };
    const longGap = { saves: 4, intervalDays: 16, dueOn: '2026-12-01' };
    expect(moreConservative(longGap, shortGap)).toEqual(shortGap);
    expect(moreConservative(soon, soon)).toEqual(soon);
  });

  it('orders due cards ahead of later ones, oldest first', () => {
    const ordered = orderForReview(
      [
        { id: 'later', dueOn: '2027-01-01' },
        { id: 'today', dueOn: TODAY },
        { id: 'overdue', dueOn: '2026-01-01' },
        { id: 'soon', dueOn: '2026-12-01' },
      ],
      TODAY,
    );
    expect(ordered.map((entry) => entry.id)).toEqual(['overdue', 'today', 'soon', 'later']);
  });

  it('labels the due count', () => {
    expect(dueTodayLabel(0)).toBe('Nothing due today');
    expect(dueTodayLabel(1)).toBe('1 due today');
    expect(dueTodayLabel(4)).toBe('4 due today');
  });

  it('migrates a two-save card to due now and leaves a real schedule alone', () => {
    expect(scheduleFromSaved({ saves: 1 }, TODAY)).toEqual(dueNow(TODAY));
    expect(scheduleFromSaved({ saves: 0 }, TODAY)).toEqual(dueNow(TODAY));
    expect(scheduleFromSaved({ saves: 2, intervalDays: 3, dueOn: '2026-12-20' }, TODAY)).toEqual({
      saves: 2,
      intervalDays: 3,
      dueOn: '2026-12-20',
    });
    expect(scheduleFromSaved({ saves: 9, intervalDays: 35, dueOn: '2027-01-01' }, TODAY).saves).toBe(9);
    expect(scheduleFromSaved({ saves: 1, intervalDays: 16, dueOn: '2027-03-01' }, TODAY)).toEqual({
      saves: 1,
      intervalDays: 1,
      dueOn: '2027-03-01',
    });
  });

  it('packs scheduled cards above the old 0/1 mirror and unpacks them', () => {
    const steps = [1, 3, 7, 16, 35].map((intervalDays, index) => ({
      saves: index + 1,
      intervalDays,
      dueOn: addLocalDays(TODAY, intervalDays),
    }));
    expect(steps.map(packIntervalDays)).toEqual([101, 203, 307, 416, 535]);
    for (const schedule of steps) {
      expect(scheduleFromStored(packIntervalDays(schedule), schedule.dueOn, TODAY)).toEqual(schedule);
    }
    expect(packIntervalDays(dueNow(TODAY))).toBe(0);
    expect(scheduleFromStored(0, '2026-03-02', TODAY)).toEqual({
      saves: 0,
      intervalDays: 0,
      dueOn: '2026-03-02',
    });
    expect(scheduleFromStored(1, '2026-12-01', TODAY)).toEqual(dueNow(TODAY));
    expect(scheduleFromStored(0, '2027-01-01', TODAY)).toEqual(dueNow(TODAY));
    expect(scheduleFromStored(0, null, TODAY)).toEqual(dueNow(TODAY));
    expect(scheduleFromStored(INTERVAL_PACK * 2 + 3, null, TODAY).dueOn).toBe(addLocalDays(TODAY, 3));
    const capped = advanceSchedule({ saves: MAX_SAVES, intervalDays: 35, dueOn: TODAY }, TODAY);
    expect(capped.saves).toBe(MAX_SAVES);
    expect(capped.intervalDays).toBe(35);
    expect(packIntervalDays(capped)).toBeLessThanOrEqual(3650);
  });
});
