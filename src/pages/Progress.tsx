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
import { REWARDS, TRACK_LABELS, TRACKS, type Account, type AccountService, type FeedbackKind, type ProgressSummary, type TrackProgress } from '../types';

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

function ScoringCard() {
  const rules = [
    `TIQ: first attempt only, +${REWARDS.ratingCorrect} for correct and ${REWARDS.ratingIncorrect} for wrong.`,
    `XP: +${REWARDS.firstCorrectXp} the first time you solve each question.`,
    `Daily: +${REWARDS.dailyCompleteXp} XP once per UTC day and it extends your streak.`,
    `Battle: +${REWARDS.battleCompleteXp} XP when a tie-break is completed; points follow first to 7, win by 2.`,
    'Mastery: one mastered puzzle for each distinct question answered correctly.',
  ];
  return (
    <Card as="section" aria-labelledby="scoring-heading">
      <h2 id="scoring-heading" className="font-bold">
        Scoring
      </h2>
      <ul className="mt-2 flex flex-col gap-2 text-xs leading-snug text-ink/75">
        {rules.map((rule) => (
          <li key={rule} className="border-l-4 border-card-line pl-2">
            {rule}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function accountError(e: unknown): { code: string | undefined; text: string } {
  const text = e instanceof Error ? e.message : 'Something went wrong.';
  if (/manual linking is disabled/i.test(text)) {
    return {
      code: 'manual_linking_disabled',
      text: 'Google linking is not enabled in Supabase yet. Enable manual identity linking to keep this guest progress with Google.',
    };
  }
  return { code: undefined, text };
}

function oauthErrorText(code: string | undefined, fallback: string) {
  if (code === 'identity_already_exists') return 'That Google account is already linked to other Tennis IQ progress.';
  return fallback;
}

export function ProfileDrawer({ account: service }: { account: AccountService }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && !!readOAuthError(window.location.href));
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
      setError(accountError(e));
    }
  };

  return (
    <aside
      className={`fixed right-0 top-24 z-30 flex items-start transition-transform duration-200 ease-out ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%-2.75rem)]'
      }`}
      aria-label="Profile drawer"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="profile-drawer-panel"
        onClick={() => setOpen((v) => !v)}
        className="pixel-hud-panel flex h-32 w-11 items-center justify-center bg-cta-500 text-white shadow-[0_5px_0_#0a151e] focus:outline-none focus:ring-4 focus:ring-ball"
      >
        <span className="font-pixel rotate-180 text-sm font-bold [writing-mode:vertical-rl]">Profile</span>
      </button>

      <div
        id="profile-drawer-panel"
        className="pixel-hud-panel min-h-32 w-72 max-w-[calc(100vw-3.25rem)] bg-navy-900 p-3 text-card shadow-[0_8px_0_rgb(10_21_30/0.65)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-pixel text-base font-bold">Profile</h2>
          <button
            type="button"
            aria-label="Close profile"
            onClick={() => setOpen(false)}
            className="pixel-icon-button h-9 w-9 text-white"
          >
            X
          </button>
        </div>

        {!account ? (
          <p className="mt-2 text-sm text-card/75">Checking account...</p>
        ) : account.kind === 'google' ? (
          <>
            <p className="mt-2 text-sm text-card/80">
              Signed in with Google{account.email ? ` as ${account.email}` : ''}.
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
            <p className="mt-2 text-sm text-card/80">Guest progress is saved on this device.</p>
            <Button block className="mt-3" disabled={busy} onClick={() => void act(() => service.signInWithGoogle())}>
              {busy ? 'Opening Google...' : 'Continue with Google'}
            </Button>
          </>
        )}

        {error && (
          <div role="alert" className="mt-3 text-sm text-card/80">
            <p>{error.text}</p>
            {error.code === 'identity_already_exists' && (
              <>
                <Button
                  variant="secondary"
                  className="mt-2"
                  disabled={busy}
                  onClick={() => void act(() => service.signInWithGoogle({ switchAccount: true }))}
                >
                  Switch to that account
                </Button>
                <p className="mt-1 text-xs text-card/60">Switching leaves this device's guest progress behind.</p>
              </>
            )}
            {error.code === 'manual_linking_disabled' && (
              <>
                <Button
                  variant="secondary"
                  className="mt-2"
                  disabled={busy}
                  onClick={() => void act(() => service.signInWithGoogle({ switchAccount: true }))}
                >
                  Sign in without guest progress
                </Button>
                <p className="mt-1 text-xs text-card/60">Enable manual linking in Supabase Auth to preserve guest progress.</p>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; data: ProgressSummary };

type FeedbackState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  suggestion: 'Suggestion',
  recommendation: 'Recommendation',
  bug: 'Bug',
};

const CONTACT_LINKS: { label: string; href: string }[] = [
  { label: 'Email', href: '' },
  { label: 'Facebook', href: '' },
  { label: 'Instagram', href: '' },
];

const composerClass =
  'w-full border-4 border-navy-900 bg-white px-3 py-2 text-sm text-ink shadow-[inset_0_-3px_0_#d5b77a] focus:outline-none focus:ring-4 focus:ring-ball disabled:opacity-60';

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
    <Card as="section" aria-labelledby="feedback-heading" className="p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="feedback-heading" className="font-bold">
          Feedback
        </h2>
        <span className="font-pixel bg-navy-900 px-2 py-1 text-[11px] font-bold text-card">{FEEDBACK_LABELS[kind]}</span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="max-w-[88%] bg-navy-900 px-3 py-2 text-sm font-semibold text-card shadow-[4px_4px_0_#d5b77a]">
          Send a suggestion, recommendation, or bug report.
        </div>
        {state.kind === 'error' && (
          <div role="alert" className="ml-auto max-w-[88%] bg-wrong px-3 py-2 text-sm font-bold text-white shadow-[4px_4px_0_#0a151e]">
            {state.message}
          </div>
        )}
        {state.kind === 'sent' && (
          <div className="ml-auto max-w-[88%] bg-correct px-3 py-2 text-sm font-bold text-white shadow-[4px_4px_0_#0a151e]">
            Thanks. Your feedback was sent.
          </div>
        )}
        {isPractice && (
          <div className="ml-auto max-w-[88%] bg-wrong/90 px-3 py-2 text-sm font-bold text-white shadow-[4px_4px_0_#0a151e]">
            Feedback needs Supabase ranked mode to be connected.
          </div>
        )}
      </div>

      <div className="mt-3 border-4 border-navy-900 bg-white p-2 shadow-[inset_0_-3px_0_#d5b77a]">
        <p className="font-pixel text-xs font-bold text-ink/70">Contact</p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {CONTACT_LINKS.map((link) =>
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                className="border-4 border-navy-900 bg-card px-1 py-2 text-center text-xs font-bold text-ink shadow-[0_3px_0_#0a151e] focus:outline-none focus:ring-4 focus:ring-ball"
              >
                {link.label}
              </a>
            ) : (
              <span
                key={link.label}
                className="border-4 border-navy-900 bg-card-line px-1 py-2 text-center text-xs font-bold text-ink/50 shadow-[0_3px_0_#0a151e]"
              >
                {link.label}
              </span>
            ),
          )}
        </div>
      </div>

      <form className="mt-3 flex flex-col gap-2" onSubmit={submit}>
        <div className="grid grid-cols-3 gap-1" aria-label="Feedback type">
          {(['suggestion', 'recommendation', 'bug'] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              className={`border-4 border-navy-900 px-1 py-2 text-xs font-bold shadow-[0_3px_0_#0a151e] focus:outline-none focus:ring-4 focus:ring-ball disabled:opacity-60 ${
                kind === option ? 'bg-cta-500 text-white' : 'bg-white text-ink hover:bg-card'
              }`}
            >
              {FEEDBACK_LABELS[option]}
            </button>
          ))}
        </div>
        <textarea
          aria-label="Feedback message"
          className={`${composerClass} min-h-16 resize-y`}
          value={message}
          disabled={disabled}
          maxLength={2000}
          placeholder="Type your feedback..."
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            aria-label="Optional contact"
            className={composerClass}
            value={contact}
            disabled={disabled}
            maxLength={120}
            placeholder="Contact optional"
            onChange={(e) => setContact(e.target.value)}
          />
          <Button type="submit" disabled={disabled} className="min-w-20 px-3">
            {state.kind === 'sending' ? '...' : 'Send'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function FeedbackDrawer({ session }: { session: ReadySession }) {
  const [open, setOpen] = useState(false);
  return (
    <aside
      className={`fixed right-0 top-60 z-30 flex items-start transition-transform duration-200 ease-out ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%-2.75rem)]'
      }`}
      aria-label="Feedback drawer"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="feedback-drawer-panel"
        onClick={() => setOpen((v) => !v)}
        className="pixel-hud-panel flex h-32 w-11 items-center justify-center bg-gold text-navy-950 shadow-[0_5px_0_#0a151e] focus:outline-none focus:ring-4 focus:ring-ball"
      >
        <span className="font-pixel rotate-180 text-sm font-bold [writing-mode:vertical-rl]">Feedback</span>
      </button>
      <div id="feedback-drawer-panel" className="w-80 max-w-[calc(100vw-3.25rem)]">
        <FeedbackCard session={session} />
      </div>
    </aside>
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

      <ScoringCard />

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
          {session.service.account && <ProfileDrawer account={session.service.account} />}
          <FeedbackDrawer session={session} />
          <ProgressContent session={session} />
        </Page>
      )}
    </SessionGate>
  );
}
