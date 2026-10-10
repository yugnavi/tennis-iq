import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../app/App';
import { ScenePanel } from '../components/court';
import {
  Button,
  ButtonLink,
  Card,
  ErrorState,
  FeedbackPanel,
  Page,
  QuestionCard,
  SessionGate,
  signed,
  Spinner,
  StatusBanner,
  TopBar,
  type ReadySession,
} from '../components/ui';
import { ACADEMY_MAP_STOPS, advanceAcademyMapStop, readAcademyMapStop } from '../game/academy';
import { useAcademySession } from '../hooks/game';
import {
  ACADEMY_SESSION_SIZE,
  ACADEMY_SESSION_SIZES,
  TRACK_LABELS,
  trackSchema,
  type AcademySessionSize,
  type AcademySessionState,
  type Track,
} from '../types';

function snippet(text: string, max = 70) {
  return text.length > max ? `${text.slice(0, max - 1).replace(/[\s.,;:!?]+$/, '')}…` : text;
}

function parseSessionSize(value: string | null): AcademySessionSize {
  const n = Number(value);
  return ACADEMY_SESSION_SIZES.includes(n as AcademySessionSize) ? (n as AcademySessionSize) : ACADEMY_SESSION_SIZE;
}

function AcademyMapRow({ stop }: { stop: number }) {
  return (
    <ol aria-label={`Academy map stop ${stop} of ${ACADEMY_MAP_STOPS.length}`} className="mt-4 grid grid-cols-6 gap-1">
      {ACADEMY_MAP_STOPS.map((label, index) => {
        const number = index + 1;
        const unlocked = number <= stop;
        const current = number === stop;
        return (
          <li key={label} className="min-w-0">
            <span
              title={label}
              className={`font-pixel flex aspect-square items-center justify-center border-2 text-xs font-bold ${
                current
                  ? 'border-ball bg-cta-500 text-white shadow-[0_4px_0_#0a151e]'
                  : unlocked
                    ? 'border-navy-800 bg-ball text-navy-950'
                    : 'border-navy-700 bg-navy-800 text-white/40'
              }`}
            >
              {number}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Recap({ state, track, count }: { state: AcademySessionState; track: Track; count: AcademySessionSize }) {
  const correct = state.results.filter((r) => r.isCorrect).length;
  const total = state.results.length || state.questions.length || ACADEMY_SESSION_SIZE;
  const xp = state.results.reduce((sum, r) => sum + r.awards.reduce((s, a) => s + a.xp, 0), 0);
  const rating = state.results.reduce((sum, r) => sum + (r.ranked ? r.ratingDelta : 0), 0);
  const anyRanked = state.results.some((r) => r.ranked);
  const perfect = correct === total && total > 0;
  const [mapStop, setMapStop] = useState(() => readAcademyMapStop(track, count));
  const advanced = useRef(false);

  useEffect(() => {
    if (!perfect || advanced.current) return;
    advanced.current = true;
    setMapStop(advanceAcademyMapStop(track, count));
  }, [perfect, track, count]);

  return (
    <section aria-labelledby="recap-heading" className="flex flex-col gap-4">
      <Card className="text-center">
        <h2 id="recap-heading" className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Session complete
        </h2>
        <p className="mt-1 text-4xl font-extrabold">
          {correct}/{total}
        </p>
        <p className="mt-1 font-semibold">
          {perfect ? 'Perfect run! The map moved forward.' : correct >= total / 2 ? 'Nice work!' : 'Good effort - every answer teaches something.'}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm font-bold">
          <span className="bg-cta-500/15 px-3 py-1 text-cta-700">{signed(xp)} XP</span>
          {anyRanked ? (
            <span className="bg-navy-700/10 px-3 py-1 text-navy-800">TIQ {signed(rating)}</span>
          ) : (
            <span className="bg-navy-700/10 px-3 py-1 text-navy-800">Unranked practice</span>
          )}
        </div>
        <AcademyMapRow stop={mapStop} />
        <p className="mt-3 text-sm font-bold text-ink/70">
          {perfect
            ? `Current stop: ${ACADEMY_MAP_STOPS[mapStop - 1]}`
            : `Score ${total}/${total} to advance from ${ACADEMY_MAP_STOPS[mapStop - 1]}.`}
        </p>
      </Card>

      <Card as="section" aria-labelledby="recap-list-heading">
        <h3 id="recap-list-heading" className="font-bold">
          Your answers
        </h3>
        <ol className="mt-2 flex flex-col gap-2">
          {state.results.map((r, i) => {
            const q = state.questions.find((x) => x.id === r.challengeId) ?? state.questions[i];
            return (
              <li key={`${r.challengeId}-${i}`} className="flex items-start gap-2 text-sm">
                <span
                  className={`font-pixel flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold text-white ${r.isCorrect ? 'bg-correct' : 'bg-wrong'}`}
                >
                  <span aria-hidden="true">{r.isCorrect ? '✓' : '✗'}</span>
                  <span className="sr-only">{r.isCorrect ? 'Correct' : 'Incorrect'}:</span>
                </span>
                <span className="min-w-0">
                  <span className="font-semibold">Q{i + 1}.</span> {q ? snippet(q.prompt) : r.challengeId}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={state.restart}>Play again</Button>
        <ButtonLink to={ROUTES.home} variant="secondary">
          Home
        </ButtonLink>
      </div>
    </section>
  );
}

function AcademyPlay({ track, count, session }: { track: Track; count: AcademySessionSize; session: ReadySession }) {
  const state = useAcademySession(track, count);
  const total = state.questions.length || count;
  const mapStop = readAcademyMapStop(track, count);
  const title = `${TRACK_LABELS[track].title} Academy`;
  const counter =
    state.status === 'question' || state.status === 'feedback' ? (
      <span className="flex gap-2">
        <span className="pixel-chip px-2 py-1 font-semibold tabular-nums">
          Q {state.index + 1}/{total}
        </span>
        <span className="pixel-chip px-2 py-1 font-semibold tabular-nums">
          Stop {mapStop}/{ACADEMY_MAP_STOPS.length}
        </span>
      </span>
    ) : null;

  let body;
  if (state.status === 'loading') {
    body = <Spinner label="Loading questions…" />;
  } else if (state.status === 'error') {
    body = <ErrorState message={state.error ?? 'Could not load this session.'} onRetry={state.restart} />;
  } else if (state.status === 'recap') {
    body = <Recap state={state} track={track} count={count} />;
  } else if (state.current) {
    const c = state.current;
    const result = state.status === 'feedback' ? state.lastResult : undefined;
    const isLast = state.index + 1 >= total;
    body = (
      <>
        <ScenePanel challenge={c} revealed={!!result} />
        <QuestionCard
          challenge={c}
          result={result}
          submitting={state.submitting}
          onAnswer={(id) => void state.answer(id)}
          eyebrow={`Question ${state.index + 1} of ${total}`}
        />
        {state.error && (
          <p role="alert" className="pixel-card bg-wrong/20 px-3 py-2 text-sm">
            {state.error}
          </p>
        )}
        <FeedbackPanel
          result={result}
          onNext={state.next}
          nextLabel={isLast ? 'See recap' : 'Next question'}
          source={{ name: c.sourceName, url: c.sourceUrl }}
        />
      </>
    );
  } else {
    body = <Spinner />;
  }

  return (
    <Page court="clay" header={<TopBar title={title} backTo={ROUTES.academy} backLabel="Back to tracks" right={counter} />}>
      <StatusBanner status={session.status} />
      {body}
    </Page>
  );
}

export default function AcademySessionPage() {
  const { track: param } = useParams();
  const [search] = useSearchParams();
  const parsed = trackSchema.safeParse(param);
  const count = parseSessionSize(search.get('count'));

  if (!parsed.success) {
    return (
      <Page court="clay" header={<TopBar title="Academy" backTo={ROUTES.academy} />}>
        <Card className="text-center">
          <h2 className="text-xl font-bold">We don’t have that track</h2>
          <p className="mt-2">Choose Rookie, Challenger or Strategist from the Academy.</p>
          <ButtonLink to={ROUTES.academy} block className="mt-4">
            Back to Academy
          </ButtonLink>
        </Card>
      </Page>
    );
  }

  return <SessionGate>{(session) => <AcademyPlay key={`${parsed.data}:${count}`} track={parsed.data} count={count} session={session} />}</SessionGate>;
}
