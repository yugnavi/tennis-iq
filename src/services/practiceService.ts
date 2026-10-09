/**
 * Practice / unranked GameService: bundled read-only challenges + localStorage.
 * Mirrors the server's REWARDS rules locally so the game feels the same offline,
 * but every result is `ranked: false` and the status says why we're in practice.
 * Local progress is a convenience only: it is never uploaded or trusted.
 */
import { z } from 'zod';
import { computeStreaks, pickDailyChallenge, utcDateString } from '../game/daily';
import { tiebreakWinner } from '../game/tiebreak';
import {
  REWARDS,
  TRACKS,
  battleStateSchema,
  type AnswerResult,
  type AnswerSubmission,
  type Award,
  type BattleState,
  type Challenge,
  type ConnectionStatus,
  type GameService,
  type Profile,
  type ProgressSummary,
  type PublicChallenge,
  type Track,
} from '../types';
import { ServiceError } from './errors';
import { makeAward, newProfile } from './rows';

export const PRACTICE_STORAGE_KEY = 'tennis-iq:practice:v1';
const MAX_STORED_BATTLES = 20;

/** Subset of the Web Storage API; every call may throw (private mode, quota, disabled). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const stateSchema = z.object({
  userId: z.string(),
  xp: z.number().int().min(0),
  tiqRating: z.number().int().min(0),
  /** Per-challenge counters: first attempt ⇒ rating, first correct ⇒ XP. */
  challenges: z.record(z.string(), z.object({ attempted: z.number().int(), correct: z.number().int() })),
  /** UTC date → challenge id of the first recorded daily completion. */
  dailies: z.record(z.string(), z.string()),
  /** Recent battles only (pruned); lifetime totals live in battleStats. */
  battles: z.array(battleStateSchema.extend({ bonusAwarded: z.boolean() })),
  battleStats: z.object({ played: z.number().int().min(0), won: z.number().int().min(0) }),
});
type PracticeState = z.infer<typeof stateSchema>;

export type PracticeGameService = GameService & {
  /** Continue a battle that started on the server before a failover. */
  adoptBattle(state: BattleState): void;
};

export type PracticeOptions = {
  reason: string;
  challenges: Challenge[];
  storage?: StorageLike | null;
  now?: () => Date;
};

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function createPracticeService(options: PracticeOptions): PracticeGameService {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const status: ConnectionStatus = { kind: 'practice', reason: options.reason };
  const sorted = [...options.challenges].sort(byId);
  const lookup = new Map(sorted.map((c) => [c.id, c]));

  let state = load();

  function fresh(): PracticeState {
    return { userId: `local-${randomId()}`, xp: 0, tiqRating: REWARDS.ratingStart, challenges: {}, dailies: {}, battles: [], battleStats: { played: 0, won: 0 } };
  }

  function load(): PracticeState {
    try {
      const raw = storage?.getItem(PRACTICE_STORAGE_KEY);
      if (raw) {
        const parsed = stateSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      }
    } catch {
      // unreadable or corrupt storage → start fresh
    }
    return fresh();
  }

  function save(): void {
    try {
      storage?.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable: keep playing with in-memory state
    }
  }

  const profile = (): Profile => ({ ...newProfile(state.userId), xp: state.xp, tiqRating: state.tiqRating });
  const today = () => utcDateString(now());
  const toPublic = (c: Challenge): PublicChallenge => {
    const { correctOptionId: _a, explanation: _b, reviewStatus: _c, coachReviewRequired: _d, ...pub } = c;
    return pub;
  };
  const publicBattle = ({ bonusAwarded: _b, ...b }: PracticeState['battles'][number]): BattleState => b;
  const streaks = () => computeStreaks(Object.keys(state.dailies).sort(), today());

  function findBattle(id: string | undefined) {
    return state.battles.find((b) => b.battleId === id);
  }

  function pushBattle(b: PracticeState['battles'][number]) {
    for (const other of state.battles) {
      if (other.status === 'in_progress') other.status = 'abandoned';
    }
    state.battles = [...state.battles.filter((x) => x.battleId !== b.battleId), b].slice(-MAX_STORED_BATTLES);
  }

  return {
    getStatus: () => status,
    subscribe: () => () => {},

    async getProfile() {
      return profile();
    },

    async listChallenges(track?: Track) {
      return sorted.filter((c) => !track || c.track === track).map(toPublic);
    },

    async getDaily() {
      const date = today();
      const challenge = pickDailyChallenge(sorted, date);
      const s = streaks();
      return {
        date,
        challenge: toPublic(challenge),
        alreadyCompleted: date in state.dailies,
        currentStreak: s.current,
        bestStreak: s.best,
      };
    },

    async submitAnswer(sub: AnswerSubmission): Promise<AnswerResult> {
      const c = lookup.get(sub.challengeId);
      if (!c) throw new ServiceError('domain', 'unknown challenge');
      if (!c.options.some((o) => o.id === sub.optionId)) throw new ServiceError('domain', 'option does not belong to challenge');

      const battle = sub.mode === 'battle' ? findBattle(sub.battleId) : undefined;
      if (sub.mode === 'battle' && battle?.status !== 'in_progress') throw new ServiceError('domain', 'battle not active');

      const date = today();
      const isDailyChallenge = sub.mode === 'daily' && pickDailyChallenge(sorted, date).id === c.id;
      if (sub.mode === 'daily' && !isDailyChallenge) throw new ServiceError('domain', "not today's daily challenge");

      const isCorrect = sub.optionId === c.correctOptionId;
      const counters = state.challenges[c.id] ?? { attempted: 0, correct: 0 };
      const firstAttempt = counters.attempted === 0;
      const firstCorrect = isCorrect && counters.correct === 0;
      state.challenges[c.id] = { attempted: counters.attempted + 1, correct: counters.correct + (isCorrect ? 1 : 0) };

      const awards: Award[] = [];
      if (firstCorrect) awards.push(makeAward('first_correct', REWARDS.firstCorrectXp));

      let dailyRecorded: boolean | undefined;
      if (sub.mode === 'daily') {
        dailyRecorded = !(date in state.dailies);
        if (dailyRecorded) {
          state.dailies[date] = c.id;
          awards.push(makeAward('daily_complete', REWARDS.dailyCompleteXp));
        }
      }

      if (battle) {
        if (isCorrect) battle.playerPoints += 1;
        else battle.opponentPoints += 1;
        const winner = tiebreakWinner(battle.playerPoints, battle.opponentPoints);
        if (winner) {
          battle.status = winner === 'player' ? 'won' : 'lost';
          state.battleStats.played += 1;
          if (winner === 'player') state.battleStats.won += 1;
          if (!battle.bonusAwarded) {
            battle.bonusAwarded = true;
            awards.push(makeAward('battle_complete', REWARDS.battleCompleteXp));
          }
        }
      }

      const before = state.tiqRating;
      if (firstAttempt) {
        const delta = isCorrect ? REWARDS.ratingCorrect : REWARDS.ratingIncorrect;
        state.tiqRating = Math.max(REWARDS.ratingFloor, state.tiqRating + delta);
      }
      state.xp += awards.reduce((sum, a) => sum + a.xp, 0);
      save();

      return {
        challengeId: c.id,
        chosenOptionId: sub.optionId,
        isCorrect,
        correctOptionId: c.correctOptionId,
        explanation: c.explanation,
        ranked: false,
        ratingDelta: state.tiqRating - before,
        awards,
        profile: profile(),
        ...(battle ? { battle: publicBattle(battle) } : {}),
        ...(dailyRecorded === undefined ? {} : { dailyRecorded }),
      };
    },

    async startBattle() {
      const b = { battleId: randomId(), playerPoints: 0, opponentPoints: 0, status: 'in_progress' as const, bonusAwarded: false };
      pushBattle(b);
      save();
      return publicBattle(b);
    },

    async abandonBattle(battleId: string) {
      const b = findBattle(battleId);
      if (b?.status === 'in_progress') {
        b.status = 'abandoned';
        save();
      }
    },

    async getProgress(): Promise<ProgressSummary> {
      const byTrack = Object.fromEntries(
        TRACKS.map((t) => {
          const ids = sorted.filter((c) => c.track === t).map((c) => c.id);
          const counters = ids.map((id) => state.challenges[id]).filter((x) => x !== undefined);
          return [
            t,
            {
              attempted: counters.reduce((s, x) => s + x.attempted, 0),
              correct: counters.reduce((s, x) => s + x.correct, 0),
              mastered: counters.filter((x) => x.correct > 0).length,
              total: ids.length,
            },
          ];
        }),
      ) as ProgressSummary['byTrack'];
      const all = Object.values(state.challenges);
      const s = streaks();
      return {
        profile: profile(),
        totalAttempts: all.reduce((sum, x) => sum + x.attempted, 0),
        totalCorrect: all.reduce((sum, x) => sum + x.correct, 0),
        byTrack,
        battlesPlayed: state.battleStats.played,
        battlesWon: state.battleStats.won,
        dailyCompletions: Object.keys(state.dailies).length,
        currentStreak: s.current,
        bestStreak: s.best,
      };
    },

    adoptBattle(b: BattleState) {
      if (findBattle(b.battleId)) return;
      pushBattle({ ...b, bonusAwarded: false });
      save();
    },
  };
}
