import { describe, expect, it } from 'vitest';

import { getAllDrills } from '@/src/logic/drills';
import {
  DRILL_MODES,
  canonicalDrillHref,
  drillHref,
  legacyLearnRedirect,
  observedDrillHref,
  parseDrillMode,
  parseThemeFilter,
  resolveDrillQuery,
  reviewForEntries,
  reviewForTheme,
  sessionForTheme,
} from '@/src/logic/drillLink';

describe('drill deep links', () => {
  it('opens guided play and every theme by default', () => {
    expect(DRILL_MODES.map((mode) => mode.id)).toEqual(['play', 'pick', 'review']);
    expect(DRILL_MODES.map((mode) => mode.label)).toEqual([
      'Play the move',
      'Pick the safe move',
      'Review misses',
    ]);
    expect(parseDrillMode(undefined)).toBe('play');
    expect(parseDrillMode('nope')).toBe('play');
    expect(parseDrillMode('streak')).toBe('play');
    expect(parseThemeFilter(undefined)).toBe('all');
    expect(parseThemeFilter('daily')).toBe('all');
    expect(drillHref()).toBe('/drills');
    expect(drillHref('play', 'all')).toBe('/drills');
    expect(drillHref('play', 'all', false)).toBe('/drills');
    expect(resolveDrillQuery({}).streak).toBe(false);
  });

  it('round-trips mode and theme, including the mate alias', () => {
    expect(drillHref('pick', 'fork')).toBe('/drills?mode=pick&theme=fork');
    expect(drillHref('play', 'back_rank')).toBe('/drills?theme=back_rank');
    const url = new URL(drillHref('play', 'back_rank'), 'https://justdontblunder.com');
    expect(parseDrillMode(url.searchParams.get('mode') ?? undefined)).toBe('play');
    expect(parseThemeFilter(url.searchParams.get('theme') ?? undefined)).toBe('back_rank');
    expect(parseThemeFilter('mate')).toBe('missed_mate');
    expect(parseThemeFilter('missed_mate')).toBe('missed_mate');
    expect(drillHref('review', 'missed_mate')).toBe('/drills?mode=review&theme=missed_mate');
  });

  it('keeps sudden-death as a Play toggle and accepts the old streak mode link', () => {
    expect(drillHref('play', 'all', true)).toBe('/drills?streak=1');
    expect(drillHref('play', 'fork', true)).toBe('/drills?streak=1&theme=fork');
    expect(drillHref('pick', 'fork', true)).toBe('/drills?mode=pick&theme=fork');
    expect(resolveDrillQuery({ streak: '1' })).toMatchObject({ mode: 'play', streak: true, theme: 'all' });
    expect(resolveDrillQuery({ mode: 'streak', theme: 'fork' })).toMatchObject({
      mode: 'play',
      theme: 'fork',
      streak: true,
      href: '/drills?streak=1&theme=fork',
    });
    expect(canonicalDrillHref({ mode: 'play' })).toBe('/drills');
    expect(canonicalDrillHref({ mode: 'play', theme: 'back_rank' })).toBe('/drills?theme=back_rank');
    expect(canonicalDrillHref({ mode: 'streak' })).toBe('/drills?streak=1');
    expect(canonicalDrillHref({ pick: '1', theme: 'pin' })).toBe('/drills?mode=pick&theme=pin');
    expect(canonicalDrillHref({ mode: 'pick', streak: '1' })).toBe('/drills?mode=pick');
    expect(canonicalDrillHref({ mode: 'review', theme: 'mate' })).toBe('/drills?mode=review&theme=missed_mate');
    expect(observedDrillHref({ mode: 'streak', theme: 'fork' })).toBe('/drills?mode=streak&theme=fork');
    expect(observedDrillHref({ streak: '1' })).toBe(canonicalDrillHref({ streak: '1' }));
  });

  it('sends the old Learn trainer links to Drills', () => {
    expect(legacyLearnRedirect({ pick: '1' })).toBe('/drills?mode=pick');
    expect(legacyLearnRedirect({ review: '1' })).toBe('/drills?mode=review');
    expect(legacyLearnRedirect({})).toBeNull();
  });

  it('applies the theme filter to a fresh set and to the miss queue', () => {
    expect(sessionForTheme('fork').positions.every((drill) => drill.theme === 'fork')).toBe(true);
    expect(sessionForTheme('all').positions).toHaveLength(getAllDrills().length);
    const ids = getAllDrills().map((drill) => drill.id);
    const forks = reviewForTheme(ids, 'fork');
    expect(forks.positions.length).toBeGreaterThan(0);
    expect(forks.positions.every((drill) => drill.theme === 'fork')).toBe(true);
    expect(reviewForTheme(['missing-id'], 'all').positions).toHaveLength(0);
  });

  it('serves due reviews by default and puts due cards first when practicing ahead', () => {
    const entries = [
      { id: 'mate-03', dueOn: '2099-01-01', intervalDays: 35 },
      { id: 'hang-q-01', dueOn: '2020-01-01', intervalDays: 1 },
    ];
    const dueOnly = reviewForEntries(entries, 'all', '2026-11-26');
    expect(dueOnly.positions.map((drill) => drill.id)).toEqual(['hang-q-01']);

    const ahead = reviewForEntries(entries, 'all', '2026-11-26', { includeAhead: true });
    expect(ahead.positions.map((drill) => drill.id)).toEqual(['hang-q-01', 'mate-03']);
  });

  it('round-trips source=own for Play and Pick and drops it on Review', () => {
    expect(drillHref('play', 'all', false, 'own')).toBe('/drills?source=own');
    expect(drillHref('play', 'fork', false, 'own')).toBe('/drills?theme=fork&source=own');
    expect(drillHref('pick', 'pin', false, 'own')).toBe('/drills?mode=pick&theme=pin&source=own');
    expect(drillHref('review', 'all', false, 'own')).toBe('/drills?mode=review');
    expect(resolveDrillQuery({ source: 'own', theme: 'fork' })).toMatchObject({
      mode: 'play',
      theme: 'fork',
      streak: false,
      source: 'own',
      href: '/drills?theme=fork&source=own',
    });
    expect(resolveDrillQuery({ mode: 'review', source: 'own' })).toMatchObject({
      mode: 'review',
      source: 'all',
      href: '/drills?mode=review',
    });
  });
});
