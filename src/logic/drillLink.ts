import {
  createAllSession,
  createReviewSession,
  createThemeSession,
  type DrillPosition,
  type DrillSession,
  type DrillTheme,
} from '@/src/logic/drills';
import { localDateKey } from '@/src/logic/localDate';
import { filterDueEntries, orderForReview } from '@/src/logic/reviewSchedule';

export type DrillMode = 'play' | 'pick' | 'review';

export type ThemeFilter = 'all' | DrillTheme;

export const DRILL_MODES: readonly { id: DrillMode; label: string }[] = [
  { id: 'play', label: 'Play the move' },
  { id: 'pick', label: 'Pick the safe move' },
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
    case 'pick':
    case 'review':
      return value;
    case 'play':
    case 'streak':
    case undefined:
      return 'play';
    default:
      return 'play';
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

export type DrillSourceFilter = 'all' | 'own';

export function parseSourceFilter(value: string | undefined): DrillSourceFilter {
  return value === 'own' ? 'own' : 'all';
}

export type DrillQuery = {
  mode?: string;
  theme?: string;
  streak?: string;
  pick?: string;
  source?: string;
};

/**
 * Canonical drills URL.
 * Play and All stay off the query, so the default link is /drills.
 * Sudden-death is a Play option: `streak=1`, not a mode.
 */
export function drillHref(
  mode: DrillMode = 'play',
  theme: ThemeFilter = 'all',
  streak = false,
  source: DrillSourceFilter = 'all',
): string {
  const params = new URLSearchParams();
  if (mode !== 'play') params.set('mode', mode);
  if (mode === 'play' && streak) params.set('streak', '1');
  if (theme !== 'all') params.set('theme', theme === 'missed_mate' ? 'missed_mate' : theme);
  if (mode !== 'review' && source === 'own') params.set('source', 'own');
  const query = params.toString();
  return query ? `/drills?${query}` : '/drills';
}

/** Mode, theme, source, and whether Play is using sudden-death rules. */
export function resolveDrillQuery(query: DrillQuery): {
  mode: DrillMode;
  theme: ThemeFilter;
  streak: boolean;
  source: DrillSourceFilter;
  href: string;
} {
  const mode = parseDrillMode(query.pick === '1' ? 'pick' : query.mode);
  const theme = parseThemeFilter(query.theme);
  const streak = mode === 'play' && (query.mode === 'streak' || query.streak === '1');
  const source: DrillSourceFilter = mode === 'review' ? 'all' : parseSourceFilter(query.source);
  return { mode, theme, streak, source, href: drillHref(mode, theme, streak, source) };
}

/** Canonical drills URL for a raw query, including old `mode=streak` links. */
export function canonicalDrillHref(query: DrillQuery): string {
  return resolveDrillQuery(query).href;
}

/** The href the raw query already spells, before it is canonicalized. */
export function observedDrillHref(query: DrillQuery): string {
  const params = new URLSearchParams();
  if (query.mode) params.set('mode', query.mode);
  if (query.streak) params.set('streak', query.streak);
  if (query.theme) params.set('theme', query.theme);
  if (query.pick) params.set('pick', query.pick);
  if (query.source) params.set('source', query.source);
  const search = params.toString();
  return search ? `/drills?${search}` : '/drills';
}

/** Old Learn links that used to open an interactive trainer. */
export function legacyLearnRedirect(params: { pick?: string; review?: string }): string | null {
  if (params.pick === '1') return drillHref('pick');
  if (params.review === '1') return drillHref('review');
  return null;
}

export function sessionForTheme(theme: ThemeFilter, source?: readonly DrillPosition[]): DrillSession {
  if (theme === 'all') return createAllSession(source);
  return createThemeSession(theme, source);
}

export function reviewForTheme(
  ids: readonly string[],
  theme: ThemeFilter,
  personal: readonly DrillPosition[] = [],
): DrillSession {
  return createReviewSession(ids, theme === 'all' ? undefined : theme, personal);
}

/** Review loads due bank ids from the starter set and personal misses from the stored position. */
export function reviewForEntries(
  entries: readonly { id: string; dueOn?: string; intervalDays?: number; drill?: DrillPosition }[],
  theme: ThemeFilter,
  today = localDateKey(),
  options: { includeAhead?: boolean } = {},
): DrillSession {
  const source = options.includeAhead ? entries : filterDueEntries(entries, today);
  const ordered = orderForReview(source, today);
  return reviewForTheme(
    ordered.map((entry) => entry.id),
    theme,
    ordered.flatMap((entry) => (entry.drill ? [entry.drill] : [])),
  );
}

/** Count of scheduled review cards matching `theme` that are not due today yet. */
export function upcomingReviewCount(
  entries: readonly { id: string; dueOn?: string; intervalDays?: number; drill?: DrillPosition }[],
  theme: ThemeFilter,
  today = localDateKey(),
): number {
  const all = reviewForEntries(entries, theme, today, { includeAhead: true }).positions.length;
  const due = reviewForEntries(entries, theme, today, { includeAhead: false }).positions.length;
  return Math.max(0, all - due);
}
