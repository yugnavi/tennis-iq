import { useCallback, useEffect, useState } from 'react';
import { ROUTES } from '../app/App';
import { readOAuthError } from '../services';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Page,
  RatingChip,
  SessionGate,
  Spinner,
  StatusBanner,
  TopBar,
  type ReadySession,
} from '../components/ui';
import { TRACK_LABELS, TRACKS, type Account, type AccountService, type ProgressSummary, type TrackProgress } from '../types';

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

function Bar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className="pixel-progress h-4 w-full overflow-hidden bg-card-line"
    >
      <div className="h-full bg-cta-500" style={{ width: `${v}%` }} />
    </div>
  );
}

function TrackRow({ track, p }: { track: (typeof TRACKS)[number]; p: TrackProgress }) {
  const mastery = pct(p.mastered, p.total);
  const accuracy = pct(p.correct, p.attempted);
  return (
    <li className="flex gap-3">
      <Badge name={track} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <h3 className="font-bold">{TRACK_LABELS[track].title}</h3>
          <span className="text-sm text-ink/75">
            {p.mastered}/{p.total} mastered
          </span>
        </div>
        <Bar value={mastery} label={`${TRACK_LABELS[track].title} mastery`} />
        <p className="mt-1 text-xs text-ink/70">
          {p.attempted > 0 ? `${accuracy}% accuracy over ${p.attempted} answers` : 'Not started yet'}
        </p>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pixel-stat min-w-0 p-2">
      <dt className="text-xs text-ink/70">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function oauthErrorText(code: string | undefined, fallback: string) {
  if (code === 'identity_already_exists') return 'That Google account is already linked to other Tennis IQ progress.';
  return fallback;
}

function AccountCard({ account: service }: { account: AccountService }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => {
    const e = typeof window === 'undefined' ? null : readOAuthError(window.location.href);
    return e ? { code: e.code, text: oauthErrorText(e.code, e.message) } : null;
  });

  useEffect(() => {
    // Drop OAuth error params so a reload doesn't show the message again.
    if (readOAuthError(window.location.href)) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    let cancelled = false;
    service.getAccount().then((a) => !cancelled && setAccount(a), () => !cancelled && setAccount({ kind: 'guest' }));
    return () => {
      cancelled = true;
    };
  }, [service]);

  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      setBusy(false);
      setError({ code: undefined, text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  if (!account) return null;
  return (
    <Card as="section" aria-labelledby="account-heading">
      <h2 id="account-heading" className="font-bold">
        Account
      </h2>
      {account.kind === 'google' ? (
        <>
          <p className="mt-1 text-sm">
            Signed in with Google{account.email ? ` as ${account.email}` : ''}. Your progress is saved to your account.
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await service.signOut();
                window.location.assign('/');
              })
            }
          >
            Sign out
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm">
            You are playing as a guest on this device. Sign in with Google to keep your progress and use it on other
            devices.
          </p>
          <Button block className="mt-3" disabled={busy} onClick={() => void act(() => service.signInWithGoogle())}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </Button>
        </>
      )}
      {error && (
        <div role="alert" className="mt-3 text-sm text-ink/80">
          <p>{error.text}</p>
          {error.code === 'identity_already_exists' && (
            <Button
              variant="secondary"
              className="mt-2"
              disabled={busy}
              onClick={() => void act(() => service.signInWithGoogle({ switchAccount: true }))}
            >
              Switch to that account
            </Button>
          )}
          {error.code === 'identity_already_exists' && (
            <p className="mt-1 text-xs text-ink/65">Switching leaves this device’s guest progress behind.</p>
          )}
        </div>
      )}
    </Card>
  );
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; data: ProgressSummary };

function ProgressContent({ session }: { session: ReadySession }) {
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const load = useCallback(() => {
    setState({ kind: 'loading' });
    return session.service.getProgress().then(
      (data) => setState({ kind: 'ok', data }),
      (e: unknown) => setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load progress.' }),
    );
  }, [session.service]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') return <Spinner label="Loading your progress…" />;
  if (state.kind === 'error') return <ErrorState message={state.message} onRetry={() => void load()} />;

  const d = state.data;
  return (
    <>
      <Card as="section" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="font-bold">
          Profile
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="TIQ (prototype)" value={d.profile.tiqRating} />
          <Stat label="XP" value={d.profile.xp} />
          <Stat label="Answers" value={d.totalAttempts} />
          <Stat label="Accuracy" value={d.totalAttempts > 0 ? `${pct(d.totalCorrect, d.totalAttempts)}%` : '—'} />
        </dl>
        <p className="mt-2 text-xs text-ink/65">TIQ is a prototype knowledge score, not an official rating.</p>
      </Card>

      <Card as="section" aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="font-bold">
          Skills
        </h2>
        <ul className="mt-3 flex flex-col gap-4">
          {TRACKS.map((t) => (
            <TrackRow key={t} track={t} p={d.byTrack[t]} />
          ))}
        </ul>
      </Card>

      <Card as="section" aria-labelledby="modes-heading">
        <h2 id="modes-heading" className="font-bold">
          Battles &amp; daily
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Battles played" value={d.battlesPlayed} />
          <Stat label="Battles won" value={d.battlesWon} />
          <Stat label="Daily puzzles" value={d.dailyCompletions} />
          <Stat label="Current streak" value={d.currentStreak > 0 ? `🔥 ${d.currentStreak}` : '—'} />
          <Stat label="Best streak" value={d.bestStreak} />
        </dl>
      </Card>
    </>
  );
}

export default function ProgressPage() {
  return (
    <SessionGate>
      {(session) => (
        <Page court="grass" header={<TopBar title="Progress" backTo={ROUTES.home} right={<RatingChip profile={session.profile} />} />}>
          <StatusBanner status={session.status} />
          {session.service.account && <AccountCard account={session.service.account} />}
          <ProgressContent session={session} />
        </Page>
      )}
    </SessionGate>
  );
}
