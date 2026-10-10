/** Test double for GameService backed by the bundled challenge bank. */
import { CHALLENGES, toPublicChallenge } from '../../data';
import { tiebreakWinner } from '../../game/tiebreak';
import type { AnswerResult, AnswerSubmission, BattleState, DailyPuzzle, GameService, Profile, Track } from '../../types';

export type FakeOptions = {
  /** 'server' returns an authoritative `battle` on battle answers; 'practice' omits it. */
  style?: 'practice' | 'server';
  daily?: Partial<DailyPuzzle>;
  dailyRecorded?: boolean;
};

export function correctOptionFor(challengeId: string): string {
  const c = CHALLENGES.find((x) => x.id === challengeId);
  if (!c) throw new Error(`unknown challenge ${challengeId}`);
  return c.correctOptionId;
}

export function wrongOptionFor(challengeId: string): string {
  const right = correctOptionFor(challengeId);
  return ['a', 'b', 'c', 'd'].find((o) => o !== right) as string;
}

export function createFakeService(opts: FakeOptions = {}) {
  const style = opts.style ?? 'practice';
  let profile: Profile = { userId: 'fake', displayName: 'Player', xp: 0, tiqRating: 500 };
  const seen = new Set<string>();
  const battles = new Map<string, BattleState>();
  let battleCounter = 0;
  const calls = { submit: [] as AnswerSubmission[], abandon: [] as string[], startBattle: 0 };

  const service: GameService & { calls: typeof calls } = {
    calls,
    getStatus: () => ({ kind: style === 'server' ? 'ranked' : 'practice', reason: 'test' }),
    subscribe: () => () => {},
    getProfile: async () => profile,
    listChallenges: async (track?: Track) =>
      CHALLENGES.filter((c) => !track || c.track === track).map(toPublicChallenge),
    getDaily: async () => ({
      date: '2026-10-09',
      challenge: toPublicChallenge(CHALLENGES[5]!),
      alreadyCompleted: false,
      currentStreak: 2,
      bestStreak: 4,
      ...opts.daily,
    }),
    startBattle: async () => {
      calls.startBattle++;
      const b: BattleState = { battleId: `b${++battleCounter}`, playerPoints: 0, opponentPoints: 0, status: 'in_progress' };
      battles.set(b.battleId, b);
      return { ...b };
    },
    abandonBattle: async (id: string) => {
      calls.abandon.push(id);
      const b = battles.get(id);
      if (b && b.status === 'in_progress') b.status = 'abandoned';
    },
    getProgress: async () => {
      throw new Error('not used');
    },
    submitFeedback: async () => {},
    submitAnswer: async (sub: AnswerSubmission): Promise<AnswerResult> => {
      calls.submit.push(sub);
      const c = CHALLENGES.find((x) => x.id === sub.challengeId);
      if (!c) throw new Error('unknown challenge');
      const isCorrect = c.correctOptionId === sub.optionId;
      const first = !seen.has(c.id);
      seen.add(c.id);
      const awards: AnswerResult['awards'] = [];
      if (isCorrect && first) awards.push({ kind: 'first_correct', xp: 20, label: 'First correct' });
      const ratingDelta = first ? (isCorrect ? 15 : -5) : 0;
      let battle: BattleState | undefined;
      if (sub.mode === 'battle' && style === 'server') {
        const b = battles.get(sub.battleId ?? '');
        if (!b) throw new Error('no battle');
        if (isCorrect) b.playerPoints++;
        else b.opponentPoints++;
        const w = tiebreakWinner(b.playerPoints, b.opponentPoints);
        if (w) {
          b.status = w === 'player' ? 'won' : 'lost';
          awards.push({ kind: 'battle_complete', xp: 10, label: 'Battle complete' });
        }
        battle = { ...b };
      }
      const xp = awards.reduce((s, a) => s + a.xp, 0);
      profile = { ...profile, xp: profile.xp + xp, tiqRating: Math.max(0, profile.tiqRating + ratingDelta) };
      return {
        challengeId: c.id,
        chosenOptionId: sub.optionId,
        isCorrect,
        correctOptionId: c.correctOptionId,
        explanation: c.explanation,
        ranked: style === 'server' && first,
        ratingDelta,
        awards,
        profile,
        battle,
        dailyRecorded: sub.mode === 'daily' ? (opts.dailyRecorded ?? true) : undefined,
      };
    },
  };
  return service;
}
