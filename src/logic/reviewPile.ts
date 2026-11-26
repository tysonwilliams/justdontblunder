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

const THEMES: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

export function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
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
  return [next, ...rest];
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
  return [{ id: drill.id, ...schedule, drill }, ...rest];
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
  return [...added, ...kept];
}

export function reviewFromSaved(
  saved: { review?: unknown; missedIds?: unknown },
  today = localDateKey(),
): ReviewEntry[] {
  if (Array.isArray(saved.review)) return sanitize(saved.review, today);
  if (!Array.isArray(saved.missedIds)) return [];
  return sanitize(
    saved.missedIds.map((id) => ({ id, saves: 0 })),
    today,
  );
}

function sanitize(value: readonly unknown[], today: string): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as { id?: unknown; saves?: unknown; dueOn?: unknown; intervalDays?: unknown; drill?: unknown };
    if (typeof entry.id !== 'string' || entry.id.length === 0) continue;
    const schedule = scheduleFromSaved(entry, today);
    if (entry.drill === undefined) {
      if (entry.id.startsWith('own-')) continue;
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
  const source = value as { gameId?: unknown; move?: unknown };
  if (typeof source.gameId !== 'string') return undefined;
  const gameId = source.gameId.trim();
  if (gameId.length === 0 || gameId.length > 180) return undefined;
  if (typeof source.move !== 'string') return { gameId };
  const move = source.move.trim();
  if (move.length === 0 || move.length > 32) return { gameId };
  return { gameId, move };
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
