/**
 * Zod schemas for the raw SQL/RPC shapes (snake_case) and their mapping onto the
 * shared TS contract. Every Supabase response passes through here before the
 * app sees it; a mismatch throws, which the resilient service treats as infra.
 */
import { z } from 'zod';
import {
  answerResultSchema,
  battleStateSchema,
  dailyPuzzleSchema,
  profileSchema,
  progressSummarySchema,
  publicChallengeSchema,
  REWARDS,
  type AnswerResult,
  type AnswerSubmission,
  type Award,
  type BattleState,
  type DailyPuzzle,
  type Profile,
  type ProgressSummary,
  type PublicChallenge,
} from '../types';

/** Columns the client is granted on public.challenges (anything else → permission denied). */
export const CHALLENGE_COLUMNS = 'id,track,kind,difficulty,prompt,options,court,source_name,source_url';

const challengeRowSchema = z.object({
  id: z.string(),
  track: z.string(),
  kind: z.string(),
  difficulty: z.number(),
  prompt: z.string(),
  options: z.unknown(),
  court: z.unknown().nullable(),
  source_name: z.string(),
  source_url: z.string(),
});

export function mapChallengeRow(row: unknown): PublicChallenge {
  const r = challengeRowSchema.parse(row);
  return publicChallengeSchema.parse({
    id: r.id,
    track: r.track,
    kind: r.kind,
    difficulty: r.difficulty,
    prompt: r.prompt,
    options: r.options,
    ...(r.court == null ? {} : { court: r.court }),
    sourceName: r.source_name,
    sourceUrl: r.source_url,
  });
}

const profileRowSchema = z.object({
  user_id: z.string(),
  display_name: z.string().nullable(),
  xp: z.number(),
  tiq_rating: z.number(),
});

export function mapProfileRow(row: unknown): Profile {
  const r = profileRowSchema.parse(row);
  return profileSchema.parse({
    userId: r.user_id,
    displayName: r.display_name ?? 'Player',
    xp: r.xp,
    tiqRating: r.tiq_rating,
  });
}

const sqlBattleStatus = z.enum(['active', 'won', 'lost', 'abandoned']);
const battleRowSchema = z.object({
  id: z.string(),
  player_points: z.number(),
  opponent_points: z.number(),
  status: sqlBattleStatus,
});

export function mapBattleRow(row: unknown): BattleState {
  const r = battleRowSchema.parse(row);
  return battleStateSchema.parse({
    battleId: r.id,
    playerPoints: r.player_points,
    opponentPoints: r.opponent_points,
    status: r.status === 'active' ? 'in_progress' : r.status,
  });
}

export const AWARD_LABELS: Record<Award['kind'], (xp: number) => string> = {
  first_correct: (xp) => `First correct: +${xp} XP`,
  battle_complete: (xp) => `Tie-break complete: +${xp} XP`,
  daily_complete: (xp) => `Daily puzzle: +${xp} XP`,
};

export function makeAward(kind: Award['kind'], xp: number): Award {
  return { kind, xp, label: AWARD_LABELS[kind](xp) };
}

const SQL_AWARD_KINDS = {
  first_correct: 'first_correct',
  battle_complete: 'battle_complete',
  daily_first_completion: 'daily_complete',
} as const;

const submitRowSchema = z.object({
  is_correct: z.boolean(),
  correct_option_id: z.string(),
  explanation: z.string(),
  ranked: z.boolean(),
  user_id: z.string(),
  display_name: z.string().nullable(),
  xp: z.number(),
  tiq_rating: z.number(),
  tiq_delta: z.number(),
  awards: z.array(z.object({ kind: z.enum(['first_correct', 'battle_complete', 'daily_first_completion']), xp: z.number() })),
  battle: battleRowSchema.nullable(),
  daily: z.object({ puzzle_date: z.string(), first_completion: z.boolean() }).nullable(),
});

export function mapSubmitResult(row: unknown, submission: AnswerSubmission): AnswerResult {
  const r = submitRowSchema.parse(row);
  return answerResultSchema.parse({
    challengeId: submission.challengeId,
    chosenOptionId: submission.optionId,
    isCorrect: r.is_correct,
    correctOptionId: r.correct_option_id,
    explanation: r.explanation,
    ranked: r.ranked,
    ratingDelta: r.tiq_delta,
    awards: r.awards.map((a) => makeAward(SQL_AWARD_KINDS[a.kind], a.xp)),
    profile: mapProfileRow(r),
    ...(r.battle ? { battle: mapBattleRow(r.battle) } : {}),
    ...(r.daily ? { dailyRecorded: r.daily.first_completion } : {}),
  });
}

const dailyRowSchema = z.object({
  date: z.string(),
  challenge: z.unknown(), // already camelCase + redacted by the RPC
  already_completed: z.boolean(),
  current_streak: z.number(),
  best_streak: z.number(),
});

export function mapDailyResult(row: unknown): DailyPuzzle {
  const r = dailyRowSchema.parse(row);
  return dailyPuzzleSchema.parse({
    date: r.date,
    challenge: r.challenge,
    alreadyCompleted: r.already_completed,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
  });
}

const trackRowSchema = z.object({ attempted: z.number(), correct: z.number(), mastered: z.number(), total: z.number() });
const progressRowSchema = profileRowSchema.extend({
  total_attempts: z.number(),
  total_correct: z.number(),
  by_track: z.object({ rookie: trackRowSchema, challenger: trackRowSchema, strategist: trackRowSchema }),
  battles_played: z.number(),
  battles_won: z.number(),
  daily_completions: z.number(),
  current_streak: z.number(),
  best_streak: z.number(),
});

export function mapProgressResult(row: unknown): ProgressSummary {
  const r = progressRowSchema.parse(row);
  return progressSummarySchema.parse({
    profile: mapProfileRow(r),
    totalAttempts: r.total_attempts,
    totalCorrect: r.total_correct,
    byTrack: r.by_track,
    battlesPlayed: r.battles_played,
    battlesWon: r.battles_won,
    dailyCompletions: r.daily_completions,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
  });
}

/** Default profile for a brand-new practice player. */
export function newProfile(userId: string): Profile {
  return { userId, displayName: 'Player', xp: 0, tiqRating: REWARDS.ratingStart };
}
