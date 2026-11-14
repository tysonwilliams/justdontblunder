import { addCalendarDays, cleanTimeZone, isCalendarDate, laterDate, whole } from '@/src/data/sync/dates';
import type { ReviewMeta, SyncAttempt, SyncSnapshot } from '@/src/data/sync/types';
import type { DrillPosition } from '@/src/logic/drills';
import { PUZZLE_POOL_SIZE } from '@/src/logic/puzzlePool';
import { fenKey, type ReviewEntry } from '@/src/logic/reviewPile';
import { SEEN_CAP, snapshotCursor, type ScanCursor } from '@/src/logic/scanCursor';
import type { ScanProgress, ThemeTally } from '@/src/store/progressTypes';
import type { PersistedPreferences, PersistedTraining } from '@/src/store/progressMigrate';
import { scanFromSaved } from '@/src/store/slices/scan';

const THEMES = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'] as const;

/**
 * Union the guest snapshot with the account.
 * Lists and counters keep both sides. Guest choices win when the two disagree.
 * A guest drill, review id, attempt, lesson, or seen game is not dropped to make room
 * for an account row, except the puzzle pool cap, which keeps guest drills first.
 */
export function mergeSnapshots(guest: SyncSnapshot, remote: SyncSnapshot, now = new Date().toISOString()): SyncSnapshot {
  const ownDrills = mergeDrills(guest.progress.library.ownDrills, remote.progress.library.ownDrills);
  const live = new Set(ownDrills.map((drill) => drill.id));
  const review = mergeReview(guest.progress.review.review, remote.progress.review.review);
  const training = mergeTraining(guest.progress.training, remote.progress.training);
  const missedDate = laterDate(guest.progress.review.missedDate, remote.progress.review.missedDate);
  const anchor = missedDate ?? training.lastDrillDate;
  const progress = {
    training,
    review: {
      missedDate,
      review,
      missedIds: review.map((entry) => entry.id),
    },
    library: {
      ownDrills,
      pastedIds: unionIds(guest.progress.library.pastedIds, remote.progress.library.pastedIds).filter((id) =>
        live.has(id),
      ),
      gameProfile: guest.progress.library.gameProfile ?? remote.progress.library.gameProfile,
    },
    preferences: mergePreferences(guest.progress.preferences, remote.progress.preferences),
    scan: mergeScan(guest.progress.scan, remote.progress.scan),
  };
  return {
    timezone: cleanTimeZone(guest.timezone) ?? cleanTimeZone(remote.timezone) ?? 'UTC',
    progress,
    attempts: mergeAttempts(guest.attempts, remote.attempts),
    streakDates: unionIds(
      guest.streakDates,
      remote.streakDates,
      training.lastDrillDate && isCalendarDate(training.lastDrillDate) ? [training.lastDrillDate] : [],
    )
      .filter(isCalendarDate)
      .sort(),
    lastScannedAt: mergeScannedAt(guest, remote, now),
    reviewMeta: mergeMeta(review, guest, remote, anchor),
  };
}

function mergeDrills(guest: readonly DrillPosition[], remote: readonly DrillPosition[]): DrillPosition[] {
  const out: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const drill of [...guest, ...remote]) {
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(drill);
    if (out.length >= PUZZLE_POOL_SIZE) break;
  }
  return out;
}

function mergeReview(guest: readonly ReviewEntry[], remote: readonly ReviewEntry[]): ReviewEntry[] {
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]));
  const out: ReviewEntry[] = [];
  const seen = new Set<string>();
  const fens = new Set<string>();
  const take = (entry: ReviewEntry) => {
    const key = entry.drill ? fenKey(entry.drill.fen) : null;
    if (seen.has(entry.id) || (key && fens.has(key))) return;
    if (key) fens.add(key);
    seen.add(entry.id);
    out.push(entry);
  };
  for (const entry of guest) {
    const other = remoteById.get(entry.id);
    take(other?.drill && !entry.drill ? { ...entry, drill: other.drill } : entry);
  }
  for (const entry of remote) take(entry);
  return out;
}

function mergeTraining(guest: PersistedTraining, remote: PersistedTraining): PersistedTraining {
  return {
    dailyStreak: Math.max(whole(guest.dailyStreak), whole(remote.dailyStreak)),
    lastDrillDate: laterDate(guest.lastDrillDate, remote.lastDrillDate),
    drillsCompleted: Math.max(whole(guest.drillsCompleted), whole(remote.drillsCompleted)),
    drillsCorrect: Math.max(whole(guest.drillsCorrect), whole(remote.drillsCorrect)),
    blundersAvoided: Math.max(whole(guest.blundersAvoided), whole(remote.blundersAvoided)),
    blundersMade: Math.max(whole(guest.blundersMade), whole(remote.blundersMade)),
    practiceMoves: Math.max(whole(guest.practiceMoves), whole(remote.practiceMoves)),
    themeStats: mergeThemes(guest.themeStats, remote.themeStats),
    recordStreak: Math.max(whole(guest.recordStreak), whole(remote.recordStreak)),
    bestPuzzleStreak: Math.max(whole(guest.bestPuzzleStreak), whole(remote.bestPuzzleStreak)),
    xp: Math.max(whole(guest.xp), whole(remote.xp)),
    completedLessons: unionIds(guest.completedLessons, remote.completedLessons),
  };
}

function mergeThemes(
  guest: PersistedTraining['themeStats'],
  remote: PersistedTraining['themeStats'],
): PersistedTraining['themeStats'] {
  const out: PersistedTraining['themeStats'] = {};
  for (const theme of THEMES) {
    const left = guest[theme];
    const right = remote[theme];
    const tally = mergeTally(left, right);
    if (tally) out[theme] = tally;
  }
  return out;
}

function mergeTally(left: ThemeTally | undefined, right: ThemeTally | undefined): ThemeTally | undefined {
  if (!left) return right;
  if (!right) return left;
  const attempts = Math.max(whole(left.attempts), whole(right.attempts));
  const correct = Math.min(attempts, Math.max(whole(left.correct), whole(right.correct)));
  return { attempts, correct };
}

function mergePreferences(guest: PersistedPreferences, remote: PersistedPreferences): PersistedPreferences {
  if (guest.experience) return { ...guest };
  return {
    experience: remote.experience,
    welcomeSkipped: guest.welcomeSkipped || remote.welcomeSkipped,
    drillsPromptSkipped: guest.drillsPromptSkipped || remote.drillsPromptSkipped,
  };
}

function mergeScan(guest: ScanProgress, remote: ScanProgress): ScanProgress {
  const cursor = mergeCursors(guest.cursor, remote.cursor);
  if (guest.phase === 'idle') {
    const taken = scanFromSaved({ ...remote, cursor, incoming: false });
    return { ...taken, cursor: cursor ?? taken.cursor };
  }
  return {
    phase: guest.phase,
    found: Math.max(whole(guest.found), whole(remote.found)),
    games: Math.max(whole(guest.games), whole(remote.games)),
    message: guest.message,
    incoming: guest.incoming,
    cursor,
  };
}

function mergeCursors(guest: ScanCursor | null, remote: ScanCursor | null): ScanCursor | null {
  if (!guest) return remote ? { ...snapshotCursor(remote), resume: false } : null;
  if (!remote || remote.site !== guest.site || remote.username.toLowerCase() !== guest.username.toLowerCase()) {
    return snapshotCursor(guest);
  }
  return {
    site: guest.site,
    username: guest.username,
    seen: unionIds(guest.seen, remote.seen).slice(0, SEEN_CAP),
    newestMs: Math.max(whole(guest.newestMs), whole(remote.newestMs)),
    doneArchives: unionIds(guest.doneArchives, remote.doneArchives)
      .filter((url) => url.startsWith('https://api.chess.com/pub/'))
      .slice(0, 36),
    lichessUntil: earlierUntil(guest.lichessUntil, remote.lichessUntil),
    backfillDone: guest.backfillDone && remote.backfillDone,
    games: Math.max(whole(guest.games), whole(remote.games)),
    resume: guest.resume,
  };
}

function earlierUntil(guest: number | null, remote: number | null): number | null {
  if (guest == null) return remote;
  if (remote == null) return guest;
  return Math.min(guest, remote);
}

function mergeAttempts(guest: readonly SyncAttempt[], remote: readonly SyncAttempt[]): SyncAttempt[] {
  const out: SyncAttempt[] = [];
  const seen = new Set<string>();
  for (const attempt of [...guest, ...remote]) {
    if (seen.has(attempt.clientId)) continue;
    seen.add(attempt.clientId);
    out.push(attempt);
  }
  return out;
}

function mergeMeta(
  review: readonly ReviewEntry[],
  guest: SyncSnapshot,
  remote: SyncSnapshot,
  anchor: string | null,
): ReviewMeta[] {
  const guestEntries = new Map(guest.progress.review.review.map((entry) => [entry.id, entry]));
  const remoteEntries = new Map(remote.progress.review.review.map((entry) => [entry.id, entry]));
  const guestMeta = new Map(guest.reviewMeta.map((meta) => [meta.id, meta]));
  const remoteMeta = new Map(remote.reviewMeta.map((meta) => [meta.id, meta]));
  return review.map((entry) => {
    const history = unionIds(guestMeta.get(entry.id)?.missHistory ?? [], remoteMeta.get(entry.id)?.missHistory ?? []);
    const local = guestEntries.get(entry.id);
    const account = remoteEntries.get(entry.id);
    const saved = remoteMeta.get(entry.id);
    if (local && account && local.saves === account.saves && saved) {
      return { ...saved, id: entry.id, missHistory: history };
    }
    const explicit = local ? guestMeta.get(entry.id) : saved;
    if (explicit) return { ...explicit, id: entry.id, missHistory: history };
    const saves = entry.saves === 1 ? 1 : 0;
    return {
      id: entry.id,
      dueOn: anchor ? addCalendarDays(anchor, saves) : null,
      intervalDays: saves,
      missHistory: history,
    };
  });
}

function mergeScannedAt(guest: SyncSnapshot, remote: SyncSnapshot, now: string): string | null {
  const guestDone = guest.progress.scan.phase === 'done';
  const remoteDone = remote.progress.scan.phase === 'done';
  if (!guestDone && !remoteDone) return null;
  if (guestDone && guest.progress.scan.games > remote.progress.scan.games) return now;
  return remote.lastScannedAt ?? guest.lastScannedAt ?? (guestDone ? now : null);
}

function unionIds(...lists: readonly (readonly string[])[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
