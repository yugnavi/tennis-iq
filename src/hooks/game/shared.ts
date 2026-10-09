import { useCallback, useRef, useState } from 'react';

export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return typeof e === 'string' && e ? e : 'Something went wrong. Please try again.';
}

/**
 * State held in a ref (read synchronously by guards such as double-submit
 * protection) plus a render tick so React re-renders on every commit.
 */
export function useSyncStore<T>(initial: () => T) {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = initial();
  const [, setTick] = useState(0);
  const get = useCallback(() => ref.current as T, []);
  const set = useCallback((next: T) => {
    ref.current = next;
    setTick((t) => t + 1);
  }, []);
  return [ref.current, get, set] as const;
}
