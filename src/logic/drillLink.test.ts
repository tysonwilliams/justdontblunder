import { describe, expect, it } from 'vitest';

import { getAllDrills } from '@/src/logic/drills';
import {
  drillHref,
  legacyLearnRedirect,
  parseDrillMode,
  parseThemeFilter,
  reviewForTheme,
  sessionForTheme,
} from '@/src/logic/drillLink';

describe('drill deep links', () => {
  it('opens streak and every theme by default', () => {
    expect(parseDrillMode(undefined)).toBe('streak');
    expect(parseDrillMode('nope')).toBe('streak');
    expect(parseThemeFilter(undefined)).toBe('all');
    expect(parseThemeFilter('daily')).toBe('all');
    expect(drillHref()).toBe('/drills');
    expect(drillHref('streak', 'all')).toBe('/drills');
  });

  it('round-trips mode and theme, including the mate alias', () => {
    expect(drillHref('pick', 'fork')).toBe('/drills?mode=pick&theme=fork');
    const url = new URL(drillHref('play', 'back_rank'), 'https://justdontblunder.com');
    expect(parseDrillMode(url.searchParams.get('mode') ?? undefined)).toBe('play');
    expect(parseThemeFilter(url.searchParams.get('theme') ?? undefined)).toBe('back_rank');
    expect(parseThemeFilter('mate')).toBe('missed_mate');
    expect(parseThemeFilter('missed_mate')).toBe('missed_mate');
    expect(drillHref('review', 'missed_mate')).toBe('/drills?mode=review&theme=missed_mate');
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
});
