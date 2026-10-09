import { useCallback, useEffect, useRef } from 'react';
import { useReadySession } from '../../app/session';
import { createBattleQueue, type BattleQueue } from '../../game/battleQueue';
import { applyPoint, tiebreakServer, tiebreakWinner, type Side } from '../../game/tiebreak';
import type { AnswerResult, Award, BattleSummary, PublicChallenge, TiebreakBattleState } from '../../types';
import { errorMessage, useSyncStore } from './shared';

/** Hard safety cap so a pathological battle can never loop forever. */
export const MAX_BATTLE_POINTS = 60;

type Internal = {
  status: TiebreakBattleState['status'];
  battleId?: string;
  score: { player: number; opponent: number };
  current?: PublicChallenge;
  lastResult?: AnswerResult;
  lastPointWinner?: Side;
  summary?: BattleSummary;
  submitting: boolean;
  error?: string;
  correct: number;
  answered: number;
  xp: number;
  ratingDelta: number;
  awards: Award[];
};

const initial = (): Internal => ({
  status: 'loading',
  score: { player: 0, opponent: 0 },
  submitting: false,
  correct: 0,
  answered: 0,
  xp: 0,
  ratingDelta: 0,
  awards: [],
});

export function useTiebreakBattle(): TiebreakBattleState {
  const { service, setProfile } = useReadySession();
  const [s, get, set] = useSyncStore(initial);
  const gen = useRef(0);
  const queue = useRef<BattleQueue<PublicChallenge> | null>(null);
  const closedBattles = useRef(new Set<string>());

  const abandon = useCallback(
    async (battleId: string) => {
      if (closedBattles.current.has(battleId)) return;
      closedBattles.current.add(battleId);
      try {
        await service.abandonBattle(battleId);
      } catch {
        /* best effort: the user is leaving anyway */
      }
    },
    [service],
  );

  const load = useCallback(() => {
    const myGen = ++gen.current;
    set(initial());
    (async () => {
      try {
        const pool = await service.listChallenges();
        if (pool.length === 0) throw new Error('No questions are available for a battle yet.');
        const battle = await service.startBattle();
        if (myGen !== gen.current) {
          void abandon(battle.battleId); // stale start (e.g. unmounted / StrictMode re-run)
          return;
        }
        queue.current = createBattleQueue(pool);
        set({
          ...initial(),
          status: 'question',
          battleId: battle.battleId,
          score: { player: battle.playerPoints, opponent: battle.opponentPoints },
          current: queue.current.next(),
        });
      } catch (e) {
        if (myGen === gen.current) set({ ...get(), status: 'error', error: errorMessage(e) });
      }
    })();
  }, [service, abandon, get, set]);

  useEffect(() => {
    load();
    return () => {
      gen.current++;
    };
  }, [load]);

  const answer = useCallback(
    async (optionId: string) => {
      const cur = get();
      if (cur.submitting || cur.status !== 'question' || !cur.current || !cur.battleId) return;
      const myGen = gen.current;
      const battleId = cur.battleId;
      set({ ...cur, submitting: true });
      try {
        const result = await service.submitAnswer({ challengeId: cur.current.id, optionId, mode: 'battle', battleId });
        setProfile(result.profile);
        if (myGen !== gen.current) return;
        const prev = get();
        const pointWinner: Side = result.isCorrect ? 'player' : 'opponent';

        let score: { player: number; opponent: number };
        let winner: Side | null;
        if (result.battle) {
          // Server-authoritative score.
          if (result.battle.status === 'abandoned') throw new Error('This battle is no longer active.');
          score = { player: result.battle.playerPoints, opponent: result.battle.opponentPoints };
          winner =
            result.battle.status === 'won'
              ? 'player'
              : result.battle.status === 'lost'
                ? 'opponent'
                : tiebreakWinner(score.player, score.opponent);
        } else {
          // Practice: apply the point locally with the engine.
          const next = applyPoint({ ...prev.score, winner: null }, pointWinner);
          score = { player: next.player, opponent: next.opponent };
          winner = next.winner;
        }

        const capped = !winner && score.player + score.opponent >= MAX_BATTLE_POINTS;
        const acc = {
          correct: prev.correct + (result.isCorrect ? 1 : 0),
          answered: prev.answered + 1,
          xp: prev.xp + result.awards.reduce((sum, a) => sum + a.xp, 0),
          ratingDelta: prev.ratingDelta + result.ratingDelta,
          awards: [...prev.awards, ...result.awards],
        };
        const finished = winner !== null || capped;
        if (capped && result.battle) void abandon(battleId);
        if (finished) closedBattles.current.add(battleId);
        set({
          ...prev,
          ...acc,
          submitting: false,
          status: finished ? 'finished' : 'feedback',
          score,
          lastResult: result,
          lastPointWinner: pointWinner,
          summary: finished
            ? {
                won: winner ? winner === 'player' : score.player > score.opponent,
                playerPoints: score.player,
                opponentPoints: score.opponent,
                correctAnswers: acc.correct,
                totalAnswers: acc.answered,
                xpEarned: acc.xp,
                ratingDelta: acc.ratingDelta,
                awards: acc.awards,
              }
            : undefined,
        });
      } catch (e) {
        if (myGen === gen.current) set({ ...get(), submitting: false, status: 'error', error: errorMessage(e) });
      }
    },
    [service, setProfile, abandon, get, set],
  );

  const next = useCallback(() => {
    const cur = get();
    if (cur.status !== 'feedback' || !queue.current) return;
    set({ ...cur, status: 'question', current: queue.current.next(), lastResult: undefined });
  }, [get, set]);

  const exit = useCallback(async () => {
    gen.current++; // ignore any in-flight start/submit results
    const cur = get();
    if (cur.battleId && cur.status !== 'finished') await abandon(cur.battleId);
  }, [abandon, get]);

  const restart = useCallback(() => {
    const cur = get();
    if (cur.battleId && cur.status !== 'finished') void abandon(cur.battleId);
    load();
  }, [abandon, get, load]);

  const pointNumber = s.score.player + s.score.opponent + (s.status === 'finished' ? 0 : 1);
  return {
    status: s.status,
    score: s.score,
    server: tiebreakServer(Math.max(1, pointNumber)),
    pointNumber: Math.max(1, pointNumber),
    current: s.status === 'question' || s.status === 'feedback' || s.status === 'finished' ? s.current : undefined,
    lastResult: s.lastResult,
    lastPointWinner: s.lastPointWinner,
    summary: s.summary,
    submitting: s.submitting,
    error: s.error,
    answer,
    next,
    exit,
    restart,
  };
}
