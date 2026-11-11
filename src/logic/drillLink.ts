import {
  createAllSession,
  createReviewSession,
  createThemeSession,
  type DrillPosition,
  type DrillSession,
  type DrillTheme,
} from '@/src/logic/drills';

export type DrillMode = 'streak' | 'pick' | 'play' | 'review';

export type ThemeFilter = 'all' | DrillTheme;

export const DRILL_MODES: readonly { id: DrillMode; label: string }[] = [
  { id: 'streak', label: 'Streak' },
  { id: 'pick', label: 'Pick the safe move' },
  { id: 'play', label: 'Play the move' },
  { id: 'review', label: 'Review misses' },
];

export const THEME_FILTERS: readonly { id: ThemeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hanging', label: 'Hanging' },
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'back_rank', label: 'Back rank' },
  { id: 'missed_mate', label: 'Mate' },
];

export function parseDrillMode(value: string | undefined): DrillMode {
  switch (value) {
    case 'streak':
    case 'pick':
    case 'play':
    case 'review':
      return value;
    default:
      return 'streak';
  }
}

export function parseThemeFilter(value: string | undefined): ThemeFilter {
  switch (value) {
    case 'hanging':
    case 'fork':
    case 'pin':
    case 'back_rank':
    case 'missed_mate':
      return value;
    case 'mate':
      return 'missed_mate';
    case 'all':
    case '':
    case undefined:
      return 'all';
    default:
      return 'all';
  }
}

export function themeFilterLabel(theme: ThemeFilter): string {
  const match = THEME_FILTERS.find((item) => item.id === theme);
  return match ? match.label : 'All';
}

/** Canonical drills URL. Streak and All stay off the query so the default link is /drills. */
export function drillHref(mode: DrillMode = 'streak', theme: ThemeFilter = 'all'): string {
  const params = new URLSearchParams();
  if (mode !== 'streak') params.set('mode', mode);
  if (theme !== 'all') params.set('theme', theme === 'missed_mate' ? 'missed_mate' : theme);
  const query = params.toString();
  return query ? `/drills?${query}` : '/drills';
}

/** Old Learn links that used to open an interactive trainer. */
export function legacyLearnRedirect(params: { pick?: string; review?: string }): string | null {
  if (params.pick === '1') return drillHref('pick');
  if (params.review === '1') return drillHref('review');
  return null;
}

export function sessionForTheme(theme: ThemeFilter): DrillSession {
  if (theme === 'all') return createAllSession();
  return createThemeSession(theme);
}

export function reviewForTheme(
  ids: readonly string[],
  theme: ThemeFilter,
  personal: readonly DrillPosition[] = [],
): DrillSession {
  return createReviewSession(ids, theme === 'all' ? undefined : theme, personal);
}
