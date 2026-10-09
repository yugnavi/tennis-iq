/**
 * Daily puzzle selection + streaks (pure). Must match the server SQL
 * `daily_challenge_id`: index = (days since 1970-01-01 * DAILY_STRIDE) mod N,
 * over challenges sorted by id (byte / code-unit order).
 */
import { DAILY_STRIDE } from '../types';

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD of the given instant in UTC. */
export function utcDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${String(y).padStart(4, '0')}-${m}-${day}`;
}

/** Whole days between 1970-01-01 and the given UTC date (YYYY-MM-DD). */
export function daysSinceEpoch(utcDate: string): number {
  const m = DATE_RE.exec(utcDate);
  if (!m) throw new Error(`Invalid UTC date: ${utcDate}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (utcDateString(new Date(ms)) !== utcDate) throw new Error(`Invalid UTC date: ${utcDate}`);
  return Math.round(ms / DAY_MS);
}

export function dailyChallengeIndex(utcDate: string, count: number): number {
  if (!Number.isInteger(count) || count <= 0) throw new Error('count must be a positive integer');
  const d = daysSinceEpoch(utcDate);
  return (((d * DAILY_STRIDE) % count) + count) % count;
}

/** `sorted` must already be sorted by id (code-unit order), as the server does. */
export function pickDailyChallenge<T extends { id: string }>(sorted: T[], utcDate: string): T {
  const item = sorted[dailyChallengeIndex(utcDate, sorted.length)];
  if (!item) throw new Error('No challenges available');
  return item;
}

/**
 * Positive-only streaks. `current` = consecutive days ending today or yesterday
 * (otherwise 0); `best` = longest run ever. Dates after today are ignored.
 */
export function computeStreaks(sortedUniqueUtcDates: string[], todayUtc: string): { current: number; best: number } {
  const today = daysSinceEpoch(todayUtc);
  const days = [...new Set(sortedUniqueUtcDates.map(daysSinceEpoch))].filter((d) => d <= today).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const d of days) {
    run = prev !== undefined && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const last = days[days.length - 1];
  const current = last !== undefined && today - last <= 1 ? run : 0;
  return { current, best };
}
