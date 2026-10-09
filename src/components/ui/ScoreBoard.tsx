type ScoreBoardProps = {
  player: number;
  opponent: number;
  server: 'player' | 'opponent';
  pointNumber?: number;
  opponentName?: string;
};

function Row({ name, score, dot, serving, lead }: { name: string; score: number; dot: string; serving: boolean; lead: boolean }) {
  return (
    <>
      <dt className="flex min-w-0 items-center gap-2 font-semibold">
        <span aria-hidden="true" className={`pixel-dot inline-block h-3 w-3 shrink-0 ${dot}`} />
        <span className="truncate">{name}</span>
        {serving && (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ball">
            <span aria-hidden="true">🎾</span>
            Serving<span className="sr-only">: {name}</span>
          </span>
        )}
      </dt>
      <dd className={`text-right text-2xl font-extrabold leading-none tabular-nums ${lead ? 'text-ball' : 'text-white'}`}>{score}</dd>
    </>
  );
}

/** Tie-break HUD (concept board): player rows on the left, rules box on the right. */
export function ScoreBoard({ player, opponent, server, pointNumber, opponentName = 'Opponent' }: ScoreBoardProps) {
  return (
    <section
      aria-label={`Tie-break score: You ${player}, ${opponentName} ${opponent}`}
      className="pixel-hud flex items-stretch gap-2 bg-navy-950 p-2 text-white"
    >
      <dl className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-2 py-1">
        <Row name="You" score={player} dot="bg-ball" serving={server === 'player'} lead={player > opponent} />
        <Row name={opponentName} score={opponent} dot="bg-white/70" serving={server === 'opponent'} lead={opponent > player} />
      </dl>
      <div className="pixel-hud-panel flex w-24 shrink-0 flex-col justify-center bg-white/5 px-2 text-center text-[11px] leading-tight text-white/70">
        <span className="font-bold uppercase tracking-wide text-white">Tie-break</span>
        <span>First to 7</span>
        <span>(win by 2)</span>
        {pointNumber != null && <span className="mt-1 font-semibold text-ball">Point {pointNumber}</span>}
      </div>
    </section>
  );
}
