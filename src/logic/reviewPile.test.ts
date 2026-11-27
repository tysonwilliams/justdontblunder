import { describe, expect, it } from 'vitest';

import { addLocalDays, localDateKey } from '@/src/logic/localDate';
import { drillFromHang } from '@/src/logic/personalDrill';
import {
  enrollImportedReviews,
  installImported,
  noteSave,
  parseDrillList,
  rememberBankMiss,
  rememberPosition,
  reviewFromSaved,
} from '@/src/logic/reviewPile';
import { REVIEW_INTERVALS } from '@/src/logic/reviewSchedule';

const TODAY = '2026-11-26';

describe('review pile', () => {
  it('keeps a miss on the short box until a save schedules the next gap', () => {
    let entries = rememberBankMiss([], 'hang-q-01', undefined, TODAY);
    entries = rememberBankMiss(entries, 'mate-03', undefined, TODAY);
    expect(entries.map((entry) => entry.id)).toEqual(['mate-03', 'hang-q-01']);
    expect(entries[0]).toMatchObject({ saves: 0, intervalDays: 0, dueOn: TODAY });

    entries = noteSave(entries, 'hang-q-01', TODAY);
    expect(entries.find((entry) => entry.id === 'hang-q-01')).toMatchObject({
      saves: 1,
      intervalDays: 1,
      dueOn: addLocalDays(TODAY, 1),
    });
    entries = noteSave(entries, 'hang-q-01', TODAY);
    expect(entries.find((entry) => entry.id === 'hang-q-01')).toMatchObject({
      saves: 2,
      intervalDays: 3,
      dueOn: addLocalDays(TODAY, 3),
    });
    expect(entries.map((entry) => entry.id)).toEqual(['mate-03', 'hang-q-01']);

    entries = rememberBankMiss(
      [{ id: 'mate-03', saves: 4, intervalDays: 16, dueOn: '2026-12-01' }],
      'mate-03',
      undefined,
      TODAY,
    );
    expect(entries).toEqual([{ id: 'mate-03', saves: 0, intervalDays: 0, dueOn: TODAY }]);
  });

  it('walks the ladder and stays on the last gap', () => {
    let entries = rememberBankMiss([], 'hang-q-01', undefined, TODAY);
    const gaps: number[] = [];
    for (let step = 0; step < REVIEW_INTERVALS.length + 1; step += 1) {
      entries = noteSave(entries, 'hang-q-01', TODAY);
      gaps.push(entries[0]?.intervalDays ?? 0);
    }
    expect(gaps).toEqual([1, 3, 7, 16, 35, 35]);
    expect(entries[0]?.dueOn).toBe(addLocalDays(TODAY, 35));
  });

  it('keeps a personal miss attached so it can be restored', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    let entries = rememberBankMiss([], hang.id, hang, TODAY);
    expect(entries[0]?.drill?.fen).toBe(hang.fen);
    entries = noteSave(entries, hang.id, TODAY);
    entries = rememberBankMiss(entries, hang.id, undefined, TODAY);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.saves).toBe(0);
    expect(entries[0]?.dueOn).toBe(TODAY);
    expect(entries[0]?.drill?.note).toBe(hang.note);

    const restored = reviewFromSaved({ review: JSON.parse(JSON.stringify(entries)) as unknown }, TODAY);
    expect(restored[0]?.drill?.id).toBe(hang.id);
    expect(restored[0]?.drill?.solution).toEqual(hang.solution);
    expect(restored[0]?.saves).toBe(0);
    expect(restored[0]?.dueOn).toBe(TODAY);
  });

  it('keeps the schedule when the same practice position is stored again', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    let entries = rememberPosition([], hang, TODAY);
    entries = noteSave(entries, hang.id, TODAY);
    entries = rememberPosition(entries, { ...hang, note: 'Saved again.' }, TODAY);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.saves).toBe(1);
    expect(entries[0]?.intervalDays).toBe(1);
    expect(entries[0]?.dueOn).toBe(addLocalDays(TODAY, 1));
    expect(entries[0]?.drill?.note).toBe('Saved again.');
  });

  it('puts an imported drill first, replaces the same position, and keeps bank misses', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    const stored = rememberPosition([], hang, TODAY)[0];
    expect(stored).toBeTruthy();
    if (!stored) return;
    const bank = { id: 'hang-q-01', saves: 1, intervalDays: 1, dueOn: '2026-12-01' };
    const entries = installImported([bank, stored], [hang, hang], 8, TODAY);
    expect(entries.map((entry) => entry.id)).toEqual([hang.id, 'hang-q-01']);
    expect(entries[0]).toMatchObject({ saves: 0, intervalDays: 0, dueOn: TODAY });
    expect(entries[1]).toMatchObject({ saves: 1, intervalDays: 1, dueOn: '2026-12-01' });
  });

  it('treats an old pile as due now and keeps a card that already has a schedule', () => {
    expect(reviewFromSaved({ missedIds: ['hang-q-01'], review: undefined }, TODAY)).toEqual([
      { id: 'hang-q-01', saves: 0, intervalDays: 0, dueOn: TODAY },
    ]);
    expect(
      reviewFromSaved(
        {
          review: [{ id: 'hang-q-01', saves: 1 }],
          missedIds: ['mate-03'],
        },
        TODAY,
      ),
    ).toEqual([{ id: 'hang-q-01', saves: 0, intervalDays: 0, dueOn: TODAY }]);
    expect(
      reviewFromSaved(
        {
          review: [{ id: 'hang-q-01', saves: 2, intervalDays: 3, dueOn: '2026-12-20' }],
        },
        TODAY,
      ),
    ).toEqual([{ id: 'hang-q-01', saves: 2, intervalDays: 3, dueOn: '2026-12-20' }]);
    expect(reviewFromSaved({ review: [{ id: 'own-missing', saves: 0 }] }, TODAY)).toEqual([]);
    expect(reviewFromSaved({ review: [{ id: 'hang-q-01', saves: 4, intervalDays: 16, dueOn: '2026-12-01' }] }, localDateKey())[0]?.dueOn).toBe(
      '2026-12-01',
    );
  });

  it('auto-enrolls new imported drills without resetting already scheduled positions', () => {
    const first = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    const second = drillFromHang('4k3/8/8/8/8/8/1b6/R3K3 w - - 0 1');
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    const scheduled = noteSave(rememberPosition([], first, TODAY), first.id, TODAY);
    const enrolled = enrollImportedReviews(scheduled, [first, second], 8, TODAY);
    expect(enrolled.map((e) => e.id)).toEqual([second.id, first.id]);
    expect(enrolled.find((e) => e.id === first.id)).toMatchObject({
      saves: 1,
      intervalDays: 1,
      dueOn: addLocalDays(TODAY, 1),
    });
    expect(enrolled.find((e) => e.id === second.id)).toMatchObject({
      saves: 0,
      intervalDays: 0,
      dueOn: TODAY,
    });
  });

  it('preserves extended provenance metadata when sanitizing saved drills', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    const enriched = {
      ...hang,
      source: {
        gameId: 'c:123',
        move: 'Nc3',
        opponent: 'Carlsen',
        timeClass: 'rapid',
        moveNumber: 12,
        playedAt: 1700000000000,
        url: 'https://www.chess.com/game/live/123',
        lastMove: { from: 'g8' as const, to: 'f6' as const },
        setupFen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
      },
    };
    const [parsed] = parseDrillList([enriched]);
    expect(parsed?.source).toEqual(enriched.source);
  });
});
