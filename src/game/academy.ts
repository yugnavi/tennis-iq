/** Academy question selection (pure, deterministic per seed). */
import { ACADEMY_SESSION_SIZE, type AcademySessionSize, type Track } from '../types';
import { seededShuffle } from './random';

export const ACADEMY_MAP_STOPS = [
  'Club gate',
  'Practice wall',
  'Grass path',
  'Town court',
  'Coach deck',
  'Cup match',
] as const;

const academyMapKey = (track: Track, count: AcademySessionSize) => `tennis-iq:academy-map:${track}:${count}`;

export function readAcademyMapStop(track: Track, count: AcademySessionSize): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(academyMapKey(track, count)));
    return Number.isInteger(value) && value >= 1 ? Math.min(value, ACADEMY_MAP_STOPS.length) : 1;
  } catch {
    return 1;
  }
}

export function advanceAcademyMapStop(track: Track, count: AcademySessionSize): number {
  const next = Math.min(readAcademyMapStop(track, count) + 1, ACADEMY_MAP_STOPS.length);
  try {
    globalThis.localStorage?.setItem(academyMapKey(track, count), String(next));
  } catch {
    /* storage unavailable: progress still appears for the current recap only */
  }
  return next;
}

/**
 * Picks `count` items. Consecutive seeds walk through one seeded
 * permutation in windows, so with 10 questions and 5 per session, seeds 2k and
 * 2k+1 together cover the whole pool before a new permutation is used. If count
 * exceeds the pool, it continues into fresh shuffled cycles.
 */
export function pickAcademyQuestions<T extends { id: string }>(
  pool: T[],
  seed: number,
  count: number = ACADEMY_SESSION_SIZE,
  options: { allowRepeat?: boolean } = {},
): T[] {
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = sorted.length;
  if (n === 0 || count <= 0) return [];
  const take = options.allowRepeat ? Math.floor(count) : Math.min(Math.floor(count), n);
  const s = Math.abs(Math.floor(Number.isFinite(seed) ? seed : 0));
  const offset = s * take;
  return Array.from({ length: take }, (_, i) => {
    const absolute = offset + i;
    const cycle = Math.floor(absolute / n);
    const order = seededShuffle(sorted, cycle + 1);
    return order[absolute % n] as T;
  });
}
