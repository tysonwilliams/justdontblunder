import { describe, expect, it } from 'vitest';

import { drillFromHang } from '@/src/logic/personalDrill';
import {
  installImported,
  noteSave,
  rememberBankMiss,
  rememberPosition,
  reviewFromSaved,
} from '@/src/logic/reviewPile';

describe('review pile', () => {
  it('keeps a miss until it is saved twice, and a new miss starts over', () => {
    let entries = rememberBankMiss([], 'hang-q-01');
    entries = rememberBankMiss(entries, 'mate-03');
    expect(entries.map((entry) => entry.id)).toEqual(['mate-03', 'hang-q-01']);

    entries = noteSave(entries, 'hang-q-01');
    expect(entries.find((entry) => entry.id === 'hang-q-01')?.saves).toBe(1);
    entries = noteSave(entries, 'hang-q-01');
    expect(entries.map((entry) => entry.id)).toEqual(['mate-03']);

    entries = rememberBankMiss([{ id: 'mate-03', saves: 1 }], 'mate-03');
    expect(entries).toEqual([{ id: 'mate-03', saves: 0 }]);
  });

  it('keeps a personal miss attached so it can be restored', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    let entries = rememberBankMiss([], hang.id, hang);
    expect(entries[0]?.drill?.fen).toBe(hang.fen);
    entries = noteSave(entries, hang.id);
    entries = rememberBankMiss(entries, hang.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.saves).toBe(0);
    expect(entries[0]?.drill?.note).toBe(hang.note);

    const restored = reviewFromSaved({ review: JSON.parse(JSON.stringify(entries)) as unknown });
    expect(restored[0]?.drill?.id).toBe(hang.id);
    expect(restored[0]?.drill?.solution).toEqual(hang.solution);
    expect(restored[0]?.saves).toBe(0);
  });

  it('keeps save progress when the same practice position is stored again', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    let entries = rememberPosition([], hang);
    entries = noteSave(entries, hang.id);
    entries = rememberPosition(entries, { ...hang, note: 'Saved again.' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.saves).toBe(1);
    expect(entries[0]?.drill?.note).toBe('Saved again.');
  });

  it('puts an imported drill first, replaces the same position, and keeps bank misses', () => {
    const hang = drillFromHang('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
    expect(hang).toBeTruthy();
    if (!hang) return;
    const stored = rememberPosition([], hang)[0];
    expect(stored).toBeTruthy();
    if (!stored) return;
    const entries = installImported([{ id: 'hang-q-01', saves: 1 }, stored], [hang, hang]);
    expect(entries.map((entry) => entry.id)).toEqual([hang.id, 'hang-q-01']);
    expect(entries[0]?.saves).toBe(0);
    expect(entries[1]?.saves).toBe(1);
  });

  it('restores yesterday’s bank misses and ignores a personal id with no position', () => {
    expect(reviewFromSaved({ missedIds: ['hang-q-01'], review: undefined })).toEqual([
      { id: 'hang-q-01', saves: 0 },
    ]);
    expect(
      reviewFromSaved({
        review: [{ id: 'hang-q-01', saves: 1 }],
        missedIds: ['mate-03'],
      }),
    ).toEqual([{ id: 'hang-q-01', saves: 1 }]);
    expect(reviewFromSaved({ review: [{ id: 'own-missing', saves: 0 }] })).toEqual([]);
  });
});
