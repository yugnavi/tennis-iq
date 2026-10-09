/**
 * `domain` = the request itself was invalid (wrong option, finished battle, not
 * today's daily) and retrying elsewhere would not help: surfaced to the caller.
 * `infra` = network/server/contract failure: the resilient service switches to
 * practice mode and serves the call locally.
 */
export class ServiceError extends Error {
  readonly kind: 'domain' | 'infra';

  constructor(kind: 'domain' | 'infra', message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ServiceError';
    this.kind = kind;
  }
}

export function isDomainError(e: unknown): e is ServiceError {
  return e instanceof ServiceError && e.kind === 'domain';
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ServiceError('infra', `${what} timed out after ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
