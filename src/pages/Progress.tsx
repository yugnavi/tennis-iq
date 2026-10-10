import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
import { TRACK_LABELS, TRACKS, type Account, type AccountService, type FeedbackKind, type ProgressSummary, type TrackProgress } from '../types';

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

type FeedbackState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

const inputClass =
  'w-full border-4 border-navy-900 bg-white px-3 py-2 text-ink shadow-[inset_0_-3px_0_#d5b77a] focus:outline-none focus:ring-4 focus:ring-ball disabled:opacity-60';

function FeedbackCard({ session }: { session: ReadySession }) {
  const [kind, setKind] = useState<FeedbackKind>('suggestion');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<FeedbackState>({ kind: 'idle' });
  const isPractice = session.status.kind === 'practice';
  const disabled = state.kind === 'sending' || isPractice;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setState({ kind: 'error', message: 'Please write a little more detail.' });
      return;
    }
    setState({ kind: 'sending' });
    try {
      await session.service.submitFeedback({
        kind,
        message: trimmed,
        contact: contact.trim() || undefined,
        pageUrl: typeof window === 'undefined' ? undefined : window.location.href,
        userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
      });
      setMessage('');
      setContact('');
      setState({ kind: 'sent' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not send feedback.' });
    }
  };

  return (
    <Card as="section" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="font-bold">
        Feedback
      </h2>
      <p className="mt-1 text-sm text-ink/75">Send suggestions, recommendations, or bugs you found in the app.</p>
      {isPractice && <p className="mt-2 text-sm font-semibold text-wrong">Feedback needs Supabase ranked mode to be connected.</p>}
      <form className="mt-3 flex flex-col gap-3" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Type
          <select className={inputClass} value={kind} disabled={disabled} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
            <option value="suggestion">Suggestion</option>
            <option value="recommendation">Recommendation</option>
            <option value="bug">Bug report</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Details
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            value={message}
            disabled={disabled}
            maxLength={2000}
            placeholder="What should improve, or what bug did you find?"
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Contact optional
          <input
            className={inputClass}
            value={contact}
            disabled={disabled}
            maxLength={120}
            placeholder="Email, name, or handle"
            onChange={(e) => setContact(e.target.value)}
          />
        </label>
        <Button type="submit" block disabled={disabled}>
          {state.kind === 'sending' ? 'Sending...' : 'Send feedback'}
        </Button>
        {state.kind === 'sent' && <p className="text-sm font-bold text-correct">Thanks. Your feedback was sent.</p>}
        {state.kind === 'error' && (
          <p role="alert" className="text-sm font-bold text-wrong">
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}

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

      <FeedbackCard session={session} />
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
