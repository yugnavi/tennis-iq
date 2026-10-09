import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createGameService } from '../services';
import type { ConnectionStatus, GameService, Profile } from '../types';

type SessionValue =
  | { ready: false; error?: string }
  | {
      ready: true;
      service: GameService;
      status: ConnectionStatus;
      profile: Profile | null;
      /** Hooks call this with `result.profile` after each answer so header XP/TIQ stay fresh. */
      setProfile(profile: Profile): void;
      refreshProfile(): Promise<void>;
    };

const SessionContext = createContext<SessionValue>({ ready: false });

export function SessionProvider({ children, service: injected }: { children: ReactNode; service?: GameService }) {
  const [service, setService] = useState<GameService | null>(injected ?? null);
  const [status, setStatus] = useState<ConnectionStatus | null>(injected ? injected.getStatus() : null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (injected) return;
    let cancelled = false;
    createGameService()
      .then((s) => {
        if (cancelled) return;
        setService(s);
        setStatus(s.getStatus());
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [injected]);

  useEffect(() => {
    if (!service) return;
    const unsubscribe = service.subscribe(setStatus);
    service.getProfile().then(setProfile, () => setProfile(null));
    return unsubscribe;
  }, [service]);

  const refreshProfile = useCallback(async () => {
    if (service) setProfile(await service.getProfile());
  }, [service]);

  const value = useMemo<SessionValue>(
    () =>
      service && status
        ? { ready: true, service, status, profile, setProfile, refreshProfile }
        : { ready: false, error },
    [service, status, profile, refreshProfile, error],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}

/** For game hooks: throws if used before the session is ready (pages guard with useSession().ready). */
export function useReadySession() {
  const s = useContext(SessionContext);
  if (!s.ready) throw new Error('Session not ready');
  return s;
}
