import { Chess, type Square } from 'chess.js';

import type { DrillPosition, DrillTheme } from '@/src/logic/drills';
import { localDateKey } from '@/src/logic/localDate';
import {
  advanceSchedule,
  dueNow,
  lapseSchedule,
  scheduleFromSaved,
  type ReviewSchedule,
} from '@/src/logic/reviewSchedule';

export type ReviewEntry = ReviewSchedule & {
  id: string;
  /** Set when the position is not in the built-in bank. */
  drill?: DrillPosition;
};

export const MAX_REVIEW_ENTRIES = 250;

const THEMES: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

export function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

/** Cap the review pile so localStorage stays bounded, dropping furthest-out mastered cards first. */
export function capReviewEntries(entries: readonly ReviewEntry[], limit = MAX_REVIEW_ENTRIES): ReviewEntry[] {
  if (entries.length <= limit) return [...entries];
  const indexed = entries.map((entry, index) => ({ entry, index }));
  indexed.sort((a, b) => {
    const aDue = a.entry.dueOn ?? '';
    const bDue = b.entry.dueOn ?? '';
    if (a.entry.intervalDays !== b.entry.intervalDays) return a.entry.intervalDays - b.entry.intervalDays;
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return a.index - b.index;
  });
  const keepIndices = new Set(indexed.slice(0, limit).map((item) => item.index));
  return entries.filter((_, index) => keepIndices.has(index));
}

/** A miss goes to the front and back to the short box, due today. A personal position stays attached. */
export function rememberBankMiss(
  entries: readonly ReviewEntry[],
  id: string,
  drill?: DrillPosition,
  today = localDateKey(),
): ReviewEntry[] {
  const previous = entries.find((entry) => entry.id === id);
  const rest = entries.filter((entry) => entry.id !== id);
  const next: ReviewEntry = { id, ...lapseSchedule(today) };
  const attached = drill ?? previous?.drill;
  if (attached) next.drill = attached.id === id ? attached : { ...attached, id };
  return capReviewEntries([next, ...rest]);
}

/** Keep a personal position. Storing it again does not reset a schedule already earned. */
export function rememberPosition(
  entries: readonly ReviewEntry[],
  drill: DrillPosition,
  today = localDateKey(),
): ReviewEntry[] {
  const key = fenKey(drill.fen);
  const previous = entries.find(
    (entry) => entry.id === drill.id || (entry.drill ? fenKey(entry.drill.fen) === key : false),
  );
  const rest = entries.filter((entry) => entry !== previous);
  const schedule = previous ? scheduleFromSaved(previous, today) : dueNow(today);
  return capReviewEntries([{ id: drill.id, ...schedule, drill }, ...rest]);
}

/** One correct review. The card stays, and the next gap is the next step on the ladder. */
export function noteSave(entries: readonly ReviewEntry[], id: string, today = localDateKey()): ReviewEntry[] {
  return entries.map((entry) => {
    if (entry.id !== id) return entry;
    return { ...entry, ...advanceSchedule(scheduleFromSaved(entry, today), today) };
  });
}

/** Newest imported drills first. The same position replaces an older copy. */
export function installImported(
  entries: readonly ReviewEntry[],
  drills: readonly DrillPosition[],
  limit = 8,
  today = localDateKey(),
): ReviewEntry[] {
  const incoming: DrillPosition[] = [];
  const keys = new Set<string>();
  for (const drill of drills) {
    const key = fenKey(drill.fen);
    if (keys.has(key)) continue;
    keys.add(key);
    incoming.push(drill);
    if (incoming.length >= limit) break;
  }
  const kept = entries.filter((entry) => !entry.drill || !keys.has(fenKey(entry.drill.fen)));
  const added: ReviewEntry[] = incoming.map((drill) => ({ id: drill.id, ...dueNow(today), drill }));
  return capReviewEntries([...added, ...kept]);
}

/**
 * Auto-enroll up to `limit` newest imported personal blunders into spaced review
 * without resetting any card already scheduled in `entries`.
 */
export function enrollImportedReviews(
  entries: readonly ReviewEntry[],
  drills: readonly DrillPosition[],
  limit = 8,
  today = localDateKey(),
): ReviewEntry[] {
  const existingKeys = new Set<string>();
  const existingIds = new Set<string>();
  for (const entry of entries) {
    existingIds.add(entry.id);
    if (entry.drill) existingKeys.add(fenKey(entry.drill.fen));
  }
  const added: ReviewEntry[] = [];
  for (const drill of drills) {
    if (added.length >= limit) break;
    const key = fenKey(drill.fen);
    if (existingIds.has(drill.id) || existingKeys.has(key)) continue;
    existingIds.add(drill.id);
    existingKeys.add(key);
    added.push({ id: drill.id, ...dueNow(today), drill });
  }
  return added.length > 0 ? capReviewEntries([...added, ...entries]) : [...entries];
}

export function reviewFromSaved(
  saved: { review?: unknown; missedIds?: unknown },
  today = localDateKey(),
  ownDrills: readonly DrillPosition[] = [],
): ReviewEntry[] {
  const byId = new Map(ownDrills.map((drill) => [drill.id, drill]));
  if (Array.isArray(saved.review)) return capReviewEntries(sanitize(saved.review, today, byId));
  if (!Array.isArray(saved.missedIds)) return [];
  return capReviewEntries(
    sanitize(
      saved.missedIds.map((id) => ({ id, saves: 0 })),
      today,
      byId,
    ),
  );
}

function sanitize(value: readonly unknown[], today: string, ownById: ReadonlyMap<string, DrillPosition>): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as { id?: unknown; saves?: unknown; dueOn?: unknown; intervalDays?: unknown; drill?: unknown };
    if (typeof entry.id !== 'string' || entry.id.length === 0) continue;
    const schedule = scheduleFromSaved(entry, today);
    if (entry.drill === undefined) {
      if (entry.id.startsWith('own-')) {
        const linked = ownById.get(entry.id);
        if (!linked) continue;
        out.push({ id: linked.id, ...schedule, drill: linked });
        continue;
      }
      out.push({ id: entry.id, ...schedule });
      continue;
    }
    const drill = cleanDrill(entry.drill);
    if (!drill) continue;
    out.push({ id: drill.id, ...schedule, drill });
  }
  return out;
}

function cleanDrill(value: unknown): DrillPosition | null {
  if (!value || typeof value !== 'object') return null;
  const drill = value as Partial<DrillPosition>;
  if (typeof drill.id !== 'string' || typeof drill.fen !== 'string') return null;
  if (drill.sideToMove !== 'w' && drill.sideToMove !== 'b') return null;
  if (!isTheme(drill.theme) || !isSquare(drill.atRiskSquare)) return null;
  if (typeof drill.prompt !== 'string' || typeof drill.note !== 'string') return null;
  if (typeof drill.expectedDropCp !== 'number') return null;
  if (!Array.isArray(drill.solution) || !drill.solution.every((move) => typeof move === 'string')) return null;
  try {
    if (new Chess(drill.fen).turn() !== drill.sideToMove) return null;
  } catch {
    return null;
  }
  const acceptable = Array.isArray(drill.acceptable)
    ? drill.acceptable.filter((move): move is string => typeof move === 'string')
    : drill.solution;
  const traps = Array.isArray(drill.traps) ? drill.traps.filter(isTrap) : [];
  const source = readSource(drill.source);
  return {
    id: drill.id,
    fen: drill.fen,
    sideToMove: drill.sideToMove,
    theme: drill.theme,
    atRiskSquare: drill.atRiskSquare,
    prompt: drill.prompt,
    solution: drill.solution,
    acceptable,
    traps,
    note: drill.note,
    expectedDropCp: drill.expectedDropCp,
    ...(source ? { source } : {}),
  };
}

function readSource(value: unknown): DrillPosition['source'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as {
    gameId?: unknown;
    move?: unknown;
    opponent?: unknown;
    timeClass?: unknown;
    moveNumber?: unknown;
    playedAt?: unknown;
    url?: unknown;
    lastMove?: unknown;
    setupFen?: unknown;
  };
  if (typeof source.gameId !== 'string') return undefined;
  const gameId = source.gameId.trim();
  if (gameId.length === 0 || gameId.length > 180) return undefined;
  const out: NonNullable<DrillPosition['source']> = { gameId };
  if (typeof source.move === 'string') {
    const move = source.move.trim();
    if (move.length > 0 && move.length <= 32) out.move = move;
  }
  if (typeof source.opponent === 'string') {
    const opponent = source.opponent.trim();
    if (opponent.length > 0 && opponent.length <= 64) out.opponent = opponent;
  }
  if (typeof source.timeClass === 'string') {
    const timeClass = source.timeClass.trim().toLowerCase();
    if (timeClass.length > 0 && timeClass.length <= 24) out.timeClass = timeClass;
  }
  if (typeof source.moveNumber === 'number' && Number.isInteger(source.moveNumber) && source.moveNumber > 0 && source.moveNumber <= 500) {
    out.moveNumber = source.moveNumber;
  }
  if (typeof source.playedAt === 'number' && Number.isFinite(source.playedAt) && source.playedAt > 0) {
    out.playedAt = source.playedAt;
  }
  if (typeof source.url === 'string' && source.url.startsWith('https://') && source.url.length <= 240) {
    out.url = source.url;
  }
  if (source.lastMove && typeof source.lastMove === 'object') {
    const lm = source.lastMove as { from?: unknown; to?: unknown };
    if (isSquare(lm.from) && isSquare(lm.to)) {
      out.lastMove = { from: lm.from, to: lm.to };
    }
  }
  if (typeof source.setupFen === 'string' && source.setupFen.length <= 120) {
    try {
      new Chess(source.setupFen);
      out.setupFen = source.setupFen;
    } catch {
      // Ignore malformed setupFen.
    }
  }
  return out;
}

function isTheme(value: unknown): value is DrillTheme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

function isSquare(value: unknown): value is Square {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

function isTrap(value: unknown): value is DrillPosition['traps'][number] {
  if (!value || typeof value !== 'object') return false;
  const trap = value as { move?: unknown; line?: unknown; explanation?: unknown };
  return (
    typeof trap.move === 'string' &&
    typeof trap.explanation === 'string' &&
    Array.isArray(trap.line) &&
    trap.line.every((step) => typeof step === 'string')
  );
}

/** Saved personal puzzles. Invalid rows are dropped. One position each, newest first. */
export function parseDrillList(value: unknown, limit = 100): DrillPosition[] {
  if (!Array.isArray(value)) return [];
  const out: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const drill = cleanDrill(item);
    if (!drill) continue;
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(drill);
    if (out.length >= limit) break;
  }
  return out;
}
