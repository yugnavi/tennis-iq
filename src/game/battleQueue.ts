/** Non-repeating shuffled question queue for tie-break battles (pure). */
import { mulberry32, shuffleWith } from './random';

export type BattleQueue<T> = {
  /** Next question. Refills and reshuffles when exhausted, never repeating the last question immediately. */
  next(): T;
  /** Questions remaining before the next refill. */
  remaining(): number;
};

export function createBattleQueue<T extends { id: string }>(
  pool: readonly T[],
  rand: () => number = Math.random,
): BattleQueue<T> {
  if (pool.length === 0) throw new Error('Battle queue needs at least one question');
  let queue: T[] = [];
  let last: T | undefined;

  const refill = () => {
    queue = shuffleWith(pool, rand);
    if (last && queue.length > 1 && queue[0]?.id === last.id) {
      const swapWith = 1 + Math.floor(rand() * (queue.length - 1));
      const first = queue[0] as T;
      queue[0] = queue[swapWith] as T;
      queue[swapWith] = first;
    }
  };

  return {
    next() {
      if (queue.length === 0) refill();
      last = queue.shift() as T;
      return last;
    },
    remaining: () => queue.length,
  };
}

export function createSeededBattleQueue<T extends { id: string }>(pool: readonly T[], seed: number): BattleQueue<T> {
  return createBattleQueue(pool, mulberry32(seed));
}
