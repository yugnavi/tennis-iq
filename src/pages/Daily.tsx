import { useEffect, useState } from 'react';
import { ROUTES } from '../app/App';
import { CourtView } from '../components/court';
import { sfx } from '../lib/audio/music';
import {
  answerStateFor,
  ButtonLink,
  ErrorState,
  formatUtcDate,
  Page,
  SessionGate,
  Spinner,
  StatusBanner,
  TopBar,
  type ReadySession,
} from '../components/ui';
import { useDailyPuzzle } from '../hooks/game';
import type { AnswerResult, PublicChallenge } from '../types';

function Streak({ current, best }: { current: number; best: number }) {
  return (
    <p className="pixel-chip px-3 py-2 text-xs font-semibold">
      {current > 0 ? (
        <>
          <span aria-hidden="true">🔥 </span>
          {current}-day streak
        </>
      ) : (
        <>Play today to start a streak</>
      )}
      {best > 1 && <span className="font-normal text-white/70"> · Best: {best} days</span>}
    </p>
  );
}

function PracticeNote() {
  return (
    <p className="pixel-chip px-3 py-2 text-xs font-semibold text-white/90">
      Practice replay
    </p>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function CompactQuestion({
  challenge,
  result,
  submitting,
  onAnswer,
}: {
  challenge: PublicChallenge;
  result?: AnswerResult;
  submitting: boolean;
  onAnswer(optionId: string): void;
}) {
  const [pendingId, setPendingId] = useState<string>();
  useEffect(() => setPendingId(undefined), [challenge.id]);

  return (
    <section
      aria-labelledby={`daily-prompt-${challenge.id}`}
      className="pixel-card relative z-10 flex min-w-0 flex-col gap-2 bg-card p-3 text-ink"
    >
      <div className="min-w-0">
        <p className="font-pixel text-[11px] font-bold uppercase tracking-wide text-ink/60">Today’s Question</p>
        <h2 id={`daily-prompt-${challenge.id}`} className="mt-1 text-sm font-bold leading-snug min-[380px]:text-base">
          {challenge.prompt}
        </h2>
      </div>
      <ul className="grid min-w-0 grid-cols-1 gap-2" aria-label="Answers">
        {challenge.options.map((option, index) => {
          const state = answerStateFor(option.id, { result, pendingId, submitting });
          const locked = state === 'disabled' || state === 'correct' || state === 'wrong' || submitting;
          return (
            <li key={option.id} className="min-w-0">
              <button
                type="button"
                onClick={
                  locked
                    ? undefined
                    : () => {
                        setPendingId(option.id);
                        onAnswer(option.id);
                      }
                }
                disabled={locked}
                aria-label={`Option ${LETTERS[index] ?? index + 1}: ${option.label}`}
                data-state={state}
                className={
                  'pixel-answer-choice flex min-h-11 w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-xs leading-tight text-ink ' +
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball disabled:cursor-default ' +
                  (state === 'correct'
                    ? 'bg-[#dcf2e2] text-correct'
                    : state === 'wrong'
                      ? 'bg-[#f8e1dc] text-wrong'
                      : state === 'selected'
                        ? 'bg-[#dcf2e2]'
                        : state === 'disabled'
                          ? 'bg-white/80 opacity-70'
                          : 'bg-white hover:bg-card')
                }
              >
                <span className="font-pixel flex h-7 w-7 shrink-0 items-center justify-center bg-[#e9ece4] text-sm font-bold text-ink">
                  {LETTERS[index] ?? index + 1}
                </span>
                <span className="answer-clamp min-w-0 flex-1 font-semibold">
                  <span className="sr-only">Option {LETTERS[index] ?? index + 1}:</span>
                  {option.label}
                </span>
                {state === 'correct' && <span className="shrink-0 text-sm font-bold text-correct">✓</span>}
                {state === 'wrong' && <span className="shrink-0 text-sm font-bold text-wrong">✗</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CompactResult({
  challenge,
  result,
  recordedNow,
}: {
  challenge: PublicChallenge;
  result: AnswerResult;
  recordedNow: boolean;
}) {
  const correct = challenge.options.find((option) => option.id === result.correctOptionId);
  const chosen = challenge.options.find((option) => option.id === result.chosenOptionId);
  const headline = result.isCorrect ? 'Great read!' : 'Not quite';
  const reinforcement = result.isCorrect
    ? recordedNow
      ? 'You solved today’s puzzle and kept your momentum going.'
      : 'Nice answer. This replay still sharpens your Tennis IQ.'
    : 'Good rep. Review the best answer and take the next point.';
  useEffect(() => {
    sfx.answer(result.isCorrect);
  }, [result.challengeId, result.chosenOptionId, result.isCorrect]);

  return (
    <section
      aria-label="Answer feedback"
      className="pixel-card relative z-10 flex min-w-0 flex-col gap-2 bg-card p-3 text-ink"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-pixel text-lg font-bold leading-tight ${result.isCorrect ? 'text-correct' : 'text-wrong'}`}>
            <span aria-hidden="true">{result.isCorrect ? '✓ ' : '✗ '}</span>
            {headline}
          </p>
          <p className="mt-1 text-xs font-semibold text-ink/70">
            {recordedNow ? 'Daily reward recorded' : 'Practice replay'}
          </p>
          <p className={`mt-1 text-sm font-bold leading-snug ${result.isCorrect ? 'text-correct' : 'text-ink/75'}`}>
            {reinforcement}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs font-bold text-cta-700">
          {result.awards.slice(0, 2).map((award) => (
            <p key={`${award.kind}-${award.label}`}>{award.label}</p>
          ))}
        </div>
      </div>
      <div className="bg-white px-2.5 py-2 text-sm font-semibold shadow-sm">
        <p className="text-xs uppercase tracking-wide text-ink/55">{result.isCorrect ? 'Your winning answer' : 'Best answer'}</p>
        <p className="answer-clamp mt-0.5">{correct?.label ?? result.correctOptionId}</p>
        {!result.isCorrect && chosen && <p className="answer-clamp mt-1 text-xs text-wrong">Your pick: {chosen.label}</p>}
      </div>
      <p className="text-sm leading-snug text-ink/80">{result.explanation}</p>
      <p className="text-xs font-semibold text-ink/65">Head back home when you’re ready for the next challenge.</p>
      <ButtonLink to={ROUTES.home} variant="secondary" size="md">
        Back home
      </ButtonLink>
    </section>
  );
}

function DailyPlay({ session }: { session: ReadySession }) {
  const state = useDailyPuzzle();
  const daily = state.daily;
  const result = state.status === 'feedback' ? state.lastResult : undefined;

  let body;
  if (state.status === 'loading') {
    body = <Spinner label="Loading today’s puzzle…" />;
  } else if (state.status === 'error' || !daily) {
    body = <ErrorState message={state.error ?? 'Could not load today’s puzzle.'} />;
  } else {
    const c = daily.challenge;
    const recordedNow = result?.dailyRecorded === true;
    body = (
      <div className="daily-playfield relative isolate flex min-w-0 flex-col justify-between gap-3">
        <CourtView
          scene={c.court}
          highlight={result ? 'path' : 'none'}
          layout="backdrop"
          className="daily-court-backdrop"
        />
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="pixel-chip px-3 py-2">
            <p className="font-pixel text-sm font-bold leading-none text-white">Daily Puzzle</p>
            <p className="mt-1 text-xs text-white/75">{formatUtcDate(daily.date)} UTC</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Streak current={daily.currentStreak} best={daily.bestStreak} />
            {!result && state.completedToday && <PracticeNote />}
          </div>
        </div>
        {result ? (
          <CompactResult challenge={c} result={result} recordedNow={recordedNow} />
        ) : (
          <CompactQuestion
            challenge={c}
            submitting={state.submitting}
            onAnswer={(id) => void state.answer(id)}
          />
        )}
        {state.error && (
          <p role="alert" className="relative z-10 bg-wrong/20 px-3 py-2 text-sm">
            {state.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Page court="indoor" header={<TopBar title="Daily Puzzle" backTo={ROUTES.home} />} className="gap-0">
      <StatusBanner status={session.status} />
      {body}
    </Page>
  );
}

export default function DailyPage() {
  return <SessionGate>{(session) => <DailyPlay session={session} />}</SessionGate>;
}
