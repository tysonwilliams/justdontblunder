import { Chess, type Square } from 'chess.js';

import type { DrillPosition, DrillTheme } from '@/src/logic/drills';

/** A position leaves the pile after this many correct reviews. */
export const SAVES_TO_GRADUATE = 2;

export type ReviewEntry = {
  id: string;
  /** Correct reviews so far. A miss sets this back to 0. */
  saves: number;
  /** Set when the position is not in the built-in bank. */
  drill?: DrillPosition;
};

const THEMES: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

export function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

/** A bank miss goes to the front. Saving progress starts over. */
export function rememberBankMiss(entries: readonly ReviewEntry[], id: string): ReviewEntry[] {
  const previous = entries.find((entry) => entry.id === id);
  const rest = entries.filter((entry) => entry.id !== id);
  const next: ReviewEntry = { id, saves: 0 };
  if (previous?.drill) next.drill = previous.drill;
  return [next, ...rest];
}

/** Keep a personal position. Saving it again does not wipe a save already earned. */
export function rememberPosition(entries: readonly ReviewEntry[], drill: DrillPosition): ReviewEntry[] {
  const key = fenKey(drill.fen);
  const previous = entries.find(
    (entry) => entry.id === drill.id || (entry.drill ? fenKey(entry.drill.fen) === key : false),
  );
  const rest = entries.filter((entry) => entry !== previous);
  return [{ id: drill.id, saves: previous?.saves ?? 0, drill }, ...rest];
}

/** One correct review. The second correct review drops the position. */
export function noteSave(entries: readonly ReviewEntry[], id: string): ReviewEntry[] {
  return entries.flatMap((entry) => {
    if (entry.id !== id) return [entry];
    const saves = entry.saves + 1;
    if (saves >= SAVES_TO_GRADUATE) return [];
    return [{ ...entry, saves }];
  });
}

/** Newest imported drills first. The same position replaces an older copy. */
export function installImported(
  entries: readonly ReviewEntry[],
  drills: readonly DrillPosition[],
  limit = 8,
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
  const added: ReviewEntry[] = incoming.map((drill) => ({ id: drill.id, saves: 0, drill }));
  return [...added, ...kept];
}

export function reviewFromSaved(saved: { review?: unknown; missedIds?: unknown }): ReviewEntry[] {
  if (Array.isArray(saved.review)) return sanitize(saved.review);
  if (!Array.isArray(saved.missedIds)) return [];
  return sanitize(saved.missedIds.map((id) => ({ id, saves: 0 })));
}

function sanitize(value: readonly unknown[]): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as { id?: unknown; saves?: unknown; drill?: unknown };
    if (typeof entry.id !== 'string' || entry.id.length === 0) continue;
    const saves = entry.saves === 1 ? 1 : 0;
    if (entry.drill === undefined) {
      if (entry.id.startsWith('own-')) continue;
      out.push({ id: entry.id, saves });
      continue;
    }
    const drill = cleanDrill(entry.drill);
    if (!drill) continue;
    out.push({ id: drill.id, saves, drill });
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
  };
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
