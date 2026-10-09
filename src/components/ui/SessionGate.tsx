import type { ReactNode } from 'react';
import { useSession } from '../../app/session';
import { ErrorState, Spinner } from './Spinner';

export type ReadySession = Extract<ReturnType<typeof useSession>, { ready: true }>;

/**
 * Renders children only once the session is ready (game hooks throw before that).
 * Not ready → spinner; failed → error with a reload retry.
 */
export function SessionGate({ children }: { children: (session: ReadySession) => ReactNode }) {
  const session = useSession();
  if (!session.ready) {
    return session.error ? (
      <ErrorState title="Couldn’t start the game" message={session.error} retryLabel="Reload" />
    ) : (
      <Spinner label="Getting the court ready…" />
    );
  }
  return <>{children(session)}</>;
}
