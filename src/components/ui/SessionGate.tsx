import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useSession } from '../../app/session';
import type { Account } from '../../types';
import { Button } from './Button';
import { ErrorState, Spinner } from './Spinner';

export type ReadySession = Extract<ReturnType<typeof useSession>, { ready: true }>;
const LANDING = `${import.meta.env.BASE_URL ?? '/'}assets/landing/`;
const HERO_VARS = {
  '--hero-animated': `url(${LANDING}landing_hero_animated.webp)`,
  '--hero-still': `url(${LANDING}landing_hero_still.webp)`,
} as CSSProperties;

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function authError(e: unknown): { code?: string; text: string } {
  const text = e instanceof Error ? e.message : 'Something went wrong.';
  if (/manual linking is disabled/i.test(text)) {
    return {
      code: 'manual_linking_disabled',
      text: 'Google linking is not enabled in Supabase yet. Enable manual identity linking to keep this progress.',
    };
  }
  return { text };
}

function GoogleRequired({ session, render }: { session: ReadySession; render: (session: ReadySession) => ReactNode }) {
  const accountService = session.service.account;
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; text: string } | null>(null);

  useEffect(() => {
    if (!accountService) return;
    let cancelled = false;
    setAccount(null);
    accountService.getAccount().then(
      (a) => !cancelled && setAccount(a),
      () => !cancelled && setAccount({ kind: 'guest' }),
    );
    return () => {
      cancelled = true;
    };
  }, [accountService]);

  if (!accountService) return <>{render(session)}</>;
  if (!account) return <Spinner label="Checking your account..." />;
  if (account.kind === 'google') return <>{render(session)}</>;

  const signIn = async (switchAccount = false) => {
    setBusy(true);
    setError(null);
    try {
      await accountService.signInWithGoogle({ switchAccount });
    } catch (e) {
      setBusy(false);
      setError(authError(e));
    }
  };

  return (
    <div className="min-h-dvh bg-navy-900 text-white">
      <main
        className="landing-hero pixelated relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-cover bg-[position:30%_bottom] [overflow-wrap:anywhere]"
        style={HERO_VARS}
      >
        <header
          className="relative text-center"
          style={{
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
            paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
          }}
        >
          <h1 className="pixel-logo text-[clamp(2.75rem,15vw,4rem)] leading-none">
            <span className="text-card">TENNIS</span> <span className="text-cta-500">IQ</span>
          </h1>
          <p className="mt-3 font-['Pixelify_Sans'] text-base font-bold uppercase tracking-[0.25em] text-white [text-shadow:0_2px_0_rgb(16_31_43/0.85)]">
            Play smarter tennis
          </p>
        </header>

        <div
          className="relative mt-auto flex flex-col items-center gap-3 bg-gradient-to-b from-transparent via-navy-950/70 to-navy-950 pt-16"
          style={{
            paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
            paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
          }}
        >
          <Button block size="lg" className="max-w-[19rem]" disabled={busy} onClick={() => void signIn()}>
            <GoogleMark />
            <span>{busy ? 'Opening Google...' : 'Continue with Google'}</span>
          </Button>
          <p className="text-center text-xs font-semibold text-white/75 [text-shadow:0_2px_0_rgb(16_31_43/0.85)]">
            Save TIQ, XP, streaks and battles
          </p>
          {error && (
            <div role="alert" className="w-full max-w-[19rem] bg-navy-950/85 px-3 py-2 text-center text-xs font-semibold text-white shadow-[0_3px_0_#0a151e]">
              <p>{error.text}</p>
              {error.code === 'manual_linking_disabled' && (
                <Button variant="secondary" className="mt-2" disabled={busy} onClick={() => void signIn(true)}>
                  Sign in without guest progress
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Renders children only once the session is ready (game hooks throw before that).
 * Not ready → spinner; failed → error with a reload retry.
 */
export function SessionGate({ children, requireGoogle = false }: { children: (session: ReadySession) => ReactNode; requireGoogle?: boolean }) {
  const session = useSession();
  if (!session.ready) {
    return session.error ? (
      <ErrorState title="Couldn’t start the game" message={session.error} retryLabel="Reload" />
    ) : (
      <Spinner label="Getting the court ready…" />
    );
  }
  return requireGoogle ? <GoogleRequired session={session} render={children} /> : <>{children(session)}</>;
}
