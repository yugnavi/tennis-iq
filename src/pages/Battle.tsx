import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/App';
import { CourtView, ScenePanel } from '../components/court';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  FeedbackPanel,
  Page,
  QuestionCard,
  ScoreBoard,
  SessionGate,
  signed,
  Spinner,
  StatusBanner,
  TopBar,
  type ReadySession,
} from '../components/ui';
import { useTiebreakBattle } from '../hooks/game';
import type { BattleSummary, TiebreakBattleState } from '../types';

function Finished({ summary, onRematch, onHome }: { summary: BattleSummary; onRematch(): void; onHome(): void }) {
  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-4">
      <Card className="text-center">
        <Badge name={summary.won ? 'grandSlam' : 'challenger'} size={80} className="mx-auto" />
        <h2 id="result-heading" className="mt-2 text-2xl font-extrabold">
          {summary.won ? 'Game, Set, Match!' : 'Match over'}
        </h2>
        <p className="mt-1 font-semibold">
          {summary.won
            ? 'You won the tie-break. Sharp thinking!'
            : 'Close battles build tennis IQ — every explanation counts. Ready for a rematch?'}
        </p>
        <p className="mt-3 text-3xl font-extrabold tabular-nums" aria-label={`Final score: You ${summary.playerPoints}, Opponent ${summary.opponentPoints}`}>
          {summary.playerPoints} – {summary.opponentPoints}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
          <div className="pixel-stat p-2">
            <dt className="text-ink/70">Points won</dt>
            <dd className="text-lg font-bold">{summary.playerPoints}</dd>
          </div>
          <div className="pixel-stat p-2">
            <dt className="text-ink/70">Correct answers</dt>
            <dd className="text-lg font-bold">
              {summary.correctAnswers}/{summary.totalAnswers}
            </dd>
          </div>
          <div className="pixel-stat p-2">
            <dt className="text-ink/70">XP earned</dt>
            <dd className="text-lg font-bold">{signed(summary.xpEarned)}</dd>
          </div>
          <div className="pixel-stat p-2">
            <dt className="text-ink/70">TIQ change</dt>
            <dd className="text-lg font-bold">{signed(summary.ratingDelta)}</dd>
          </div>
        </dl>
        {summary.awards.length > 0 && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Awards">
            {summary.awards.map((a, i) => (
              <li key={`${a.kind}-${i}`} className="pixel-stat bg-cta-500/15 px-3 py-1 text-xs font-bold text-cta-700">
                {a.label} · {signed(a.xp)} XP
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onRematch}>Rematch</Button>
        <Button variant="secondary" onClick={onHome}>
          Home
        </Button>
      </div>
    </section>
  );
}

function pointLine(state: TiebreakBattleState) {
  const s = state.lastResult?.battle
    ? { player: state.lastResult.battle.playerPoints, opponent: state.lastResult.battle.opponentPoints }
    : state.score;
  const winner = state.lastPointWinner ?? (state.lastResult?.isCorrect ? 'player' : 'opponent');
  return (
    <>
      {winner === 'player' ? 'Point to you!' : 'Point to your opponent.'}{' '}
      <span className="tabular-nums">
        Score: You {s.player} – {s.opponent} Opponent
      </span>
    </>
  );
}

function BattlePlay({ session }: { session: ReadySession }) {
  const state = useTiebreakBattle();
  const navigate = useNavigate();
  // The hook moves straight to 'finished' on the deciding point; show that point's
  // feedback first and reveal the match result only when the player taps on.
  const [resultSeen, setResultSeen] = useState(false);
  useEffect(() => {
    if (state.status !== 'finished') setResultSeen(false);
  }, [state.status]);
  const reviewingFinalPoint = state.status === 'finished' && !resultSeen && !!state.lastResult;
  const goHome = () => navigate(ROUTES.home);
  const exitToHome = async () => {
    try {
      await state.exit();
    } finally {
      navigate(ROUTES.home);
    }
  };

  const right = (
    <span className="pixel-score-chip bg-white/10 px-2 py-1 font-bold tabular-nums" aria-label={`Score: You ${state.score.player}, Opponent ${state.score.opponent}`}>
      {state.score.player} – {state.score.opponent}
    </span>
  );

  let body;
  if (state.status === 'loading') {
    body = <Spinner label="Walking out to court…" />;
  } else if (state.status === 'error') {
    body = <ErrorState message={state.error ?? 'Could not start the battle.'} onRetry={state.restart} />;
  } else if (state.status === 'finished' && state.summary && !reviewingFinalPoint) {
    body = <Finished summary={state.summary} onRematch={state.restart} onHome={goHome} />;
  } else if (state.status === 'finished' && !reviewingFinalPoint) {
    body = <Spinner label="Tallying the match…" />;
  } else {
    const c = state.current;
    const result = state.status === 'feedback' || reviewingFinalPoint ? state.lastResult : undefined;
    const matchOver = reviewingFinalPoint;
    body = (
      <>
        <ScoreBoard
          player={state.score.player}
          opponent={state.score.opponent}
          server={state.server}
          pointNumber={state.pointNumber}
        />
        {c ? <ScenePanel challenge={c} revealed={!!result} fallback="court" /> : <CourtView />}
        {c && (
          <QuestionCard
            challenge={c}
            result={result}
            submitting={state.submitting}
            onAnswer={(id) => void state.answer(id)}
            eyebrow={`Point ${state.pointNumber}`}
          />
        )}
        {state.error && (
          <p role="alert" className="pixel-alert bg-wrong/20 px-3 py-2 text-sm">
            {state.error}
          </p>
        )}
        <FeedbackPanel
          result={result}
          extra={result ? pointLine(state) : undefined}
          onNext={reviewingFinalPoint ? () => setResultSeen(true) : state.next}
          nextLabel={matchOver ? 'See match result' : 'Next point'}
          source={c ? { name: c.sourceName, url: c.sourceUrl } : undefined}
        />
        <Button variant="ghost" onClick={() => void exitToHome()} className="self-center">
          Exit match
        </Button>
      </>
    );
  }

  return (
    <Page
      court="hard"
      header={
        <TopBar
          title="Tie-Break Battle"
          onBack={() => void (state.status === 'finished' ? goHome() : exitToHome())}
          backLabel="Exit to Home"
          right={right}
        />
      }
    >
      <StatusBanner status={session.status} />
      {body}
    </Page>
  );
}

export default function BattlePage() {
  return <SessionGate>{(session) => <BattlePlay session={session} />}</SessionGate>;
}
