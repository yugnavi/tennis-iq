/** Academy question selection (pure, deterministic per seed). */
import { ACADEMY_SESSION_SIZE } from '../types';
import { seededShuffle } from './random';

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
