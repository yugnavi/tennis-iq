import { useEffect, useState } from 'react';
import { ROUTES } from '../app/App';
import {
  ASSETS,
  Badge,
  ButtonLink,
  formatUtcDate,
  Page,
  rankFor,
  RatingChip,
  SessionGate,
  StatusBanner,
  TopBar,
  type ReadySession,
} from '../components/ui';
import type { DailyPuzzle, Profile, ProgressSummary } from '../types';

type Load<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; value: T };

function useLoad<T>(load: () => Promise<T>, deps: unknown[]): Load<T> {
  const [state, setState] = useState<Load<T>>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load().then(
      (value) => !cancelled && setState({ kind: 'ok', value }),
      () => !cancelled && setState({ kind: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, deps);
  return state;
}

function RatingCard({ profile }: { profile: Profile | null }) {
  const rating = profile?.tiqRating ?? 500;
  const { current, next, progress } = rankFor(rating);
  return (
    <section aria-labelledby="rating-heading" className="pixel-card bg-card p-4 text-ink">
      <div className="flex items-center gap-3">
        <Badge name={current.badge} size={68} />
        <div className="min-w-0 flex-1">
          <h2 id="rating-heading" className="font-pixel text-xs font-semibold uppercase tracking-wide text-ink/60">
            Tennis IQ Rating
          </h2>
          <p className="font-pixel text-5xl font-extrabold leading-tight tabular-nums">{profile ? rating : '—'}</p>
          <p className="font-pixel text-lg font-semibold text-cta-700">{current.title}</p>
        </div>
        {next && (
          <div className="shrink-0 border-l-4 border-card-line pl-3 text-right text-xs text-ink/65">
            <p>Next rank</p>
            <p className="font-bold text-ink">{next.title}</p>
            <p className="tabular-nums">{next.min}</p>
          </div>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={next ? `Progress to ${next.title}` : 'Top rank reached'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="pixel-progress mt-4 h-3 w-full overflow-hidden bg-card-line"
      >
        <div className="h-full bg-cta-500" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function StatTiles({ profile, progress }: { profile: Profile | null; progress: Load<ProgressSummary> }) {
  const p = progress.kind === 'ok' ? progress.value : undefined;
  const solved = p ? p.byTrack.rookie.mastered + p.byTrack.challenger.mastered + p.byTrack.strategist.mastered : undefined;
  const tiles = [
    { icon: 'flame', value: p?.currentStreak, label: 'Day streak' },
    { icon: 'star', value: profile?.xp ?? p?.profile.xp, label: 'XP' },
    { icon: 'target', value: solved, label: 'Puzzles solved' },
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="pixel-card flex min-w-0 flex-col bg-card px-2.5 py-2.5 text-ink">
          <div className="flex items-center gap-1.5">
            <img src={ASSETS.icon(t.icon)} alt="" aria-hidden="true" width={24} height={24} className="pixelated h-6 w-6 shrink-0" />
            <dd className="font-pixel text-xl font-extrabold leading-tight tabular-nums">{t.value ?? '—'}</dd>
          </div>
          <dt className="text-[11px] leading-tight text-ink/70">{t.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function DailyIconPreview() {
  return (
    <div className="pixel-daily-preview h-48 w-full min-[380px]:h-56" aria-hidden="true">
      <img src={ASSETS.icon('target')} alt="" className="pixelated pixel-daily-preview-icon" width={48} height={48} />
    </div>
  );
}

function TodayCard({ daily }: { daily: Load<DailyPuzzle> }) {
  const d = daily.kind === 'ok' ? daily.value : undefined;
  const done = !!d?.alreadyCompleted;
  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-2">
      <h2 id="today-heading" className="pixel-heading text-xl font-bold text-white">
        Today’s Challenge
      </h2>
      <div className="pixel-card overflow-hidden bg-card p-4 text-ink">
        <div className="grid min-w-0 grid-cols-[1fr_104px] gap-4 min-[380px]:grid-cols-[1fr_132px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="pixel-calendar flex h-12 w-12 shrink-0 flex-col items-center justify-center bg-navy-900 text-white"
              >
                {d ? (
                  // Real UTC date (the calendar emoji renders a fixed "JUL 17" on Apple devices).
                  <>
                    <span className="font-pixel text-[10px] font-bold uppercase leading-none text-ball">
                      {formatUtcDate(d.date).split(' ')[1]}
                    </span>
                    <span className="font-pixel text-xl font-extrabold leading-tight">{Number(d.date.slice(8, 10))}</span>
                  </>
                ) : (
                  <span className="text-xl">🎾</span>
                )}
              </span>
              <div className="min-w-0">
                <p className="font-pixel text-xl font-bold leading-tight">Daily Puzzle</p>
                <p className="text-xs text-ink/65">
                  {daily.kind === 'loading' && 'Loading today’s puzzle…'}
                  {daily.kind === 'error' && 'One shared question per day'}
                  {d && `${formatUtcDate(d.date)} (UTC)`}
                </p>
              </div>
            </div>
            <p className={`text-base font-semibold leading-snug ${done ? 'text-correct' : 'text-ink/80'}`}>
              {done ? 'Done today. Review your answer or come back tomorrow.' : 'Make the right call under pressure.'}
            </p>
            <div className="mt-auto pt-2">
              <ButtonLink to={ROUTES.daily} variant={done ? 'secondary' : 'primary'} block>
                {done ? 'Review Puzzle' : 'Play Now'}
              </ButtonLink>
            </div>
          </div>
          <DailyIconPreview />
        </div>
      </div>
    </section>
  );
}

function HomeContent({ session }: { session: ReadySession }) {
  const daily = useLoad(() => session.service.getDaily(), [session.service]);
  const progress = useLoad(() => session.service.getProgress(), [session.service, session.profile?.xp]);
  return (
    <>
      <StatusBanner status={session.status} />
      <RatingCard profile={session.profile} />
      <StatTiles profile={session.profile} progress={progress} />
      <TodayCard daily={daily} />
    </>
  );
}

export default function HomePage() {
  return (
    <SessionGate>
      {(session) => (
        <Page
          nav
          court="grass"
          header={
            <TopBar
              title={`Hi, ${session.profile?.displayName ?? 'Player'}! 👋`}
              backTo={ROUTES.landing}
              right={<RatingChip profile={session.profile} />}
            />
          }
        >
          <HomeContent session={session} />
        </Page>
      )}
    </SessionGate>
  );
}
