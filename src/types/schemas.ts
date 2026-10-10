/**
 * Shared domain schemas (Agent 1 owns this file).
 *
 * Zod schemas are the single source of truth: TypeScript types are inferred from
 * them, and they validate data at every untrusted boundary (Supabase responses,
 * bundled JSON, localStorage).
 */
import { z } from 'zod';

export const TRACKS = ['rookie', 'challenger', 'strategist'] as const;
export const trackSchema = z.enum(TRACKS);

export const QUESTION_KINDS = ['rules', 'court-position', 'shot-choice'] as const;
export const questionKindSchema = z.enum(QUESTION_KINDS);

export const PLAY_MODES = ['academy', 'battle', 'daily'] as const;
export const playModeSchema = z.enum(PLAY_MODES);

/** Normalized 0..100 coordinates over the FULL court SVG viewBox (360×580). See COURT_LANDMARKS. */
export const courtPointSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const courtSceneSchema = z.object({
  player: courtPointSchema,
  opponent: courtPointSchema,
  ball: courtPointSchema.optional(),
  recommendedPath: z.array(courtPointSchema).min(2).optional(),
  /** Accessible text description of the spatial situation (required whenever a court is shown). */
  caption: z.string().min(10),
});

export const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

/** Public, pre-answer view of a challenge: no correct answer, no explanation. */
export const publicChallengeSchema = z.object({
  id: z.string().regex(/^(rookie|challenger|strategist)-\d{2,3}$/),
  track: trackSchema,
  kind: questionKindSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string().min(10),
  options: z.array(optionSchema).length(4),
  sourceName: z.string().min(3),
  sourceUrl: z.string().url(),
  court: courtSceneSchema.optional(),
});

/** Full challenge record (bundled fallback JSON + server seed). */
export const challengeSchema = publicChallengeSchema
  .extend({
    correctOptionId: z.string().min(1),
    explanation: z.string().min(20),
    reviewStatus: z.literal('approved'),
    /** true = tactical content still needs expert coach verification (editorial flag). */
    coachReviewRequired: z.boolean(),
  })
  .refine((c) => c.options.some((o) => o.id === c.correctOptionId), {
    message: 'correctOptionId must match one of the options',
  })
  .refine((c) => new Set(c.options.map((o) => o.id)).size === 4, {
    message: 'option ids must be unique',
  });

export const profileSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  xp: z.number().int().min(0),
  tiqRating: z.number().int().min(0),
});

export const awardSchema = z.object({
  kind: z.enum(['first_correct', 'battle_complete', 'daily_complete']),
  xp: z.number().int(),
  label: z.string(),
});

export const battleStateSchema = z.object({
  battleId: z.string(),
  playerPoints: z.number().int().min(0),
  opponentPoints: z.number().int().min(0),
  status: z.enum(['in_progress', 'won', 'lost', 'abandoned']),
});

export const answerResultSchema = z.object({
  challengeId: z.string(),
  chosenOptionId: z.string(),
  isCorrect: z.boolean(),
  correctOptionId: z.string(),
  explanation: z.string(),
  /** true only if this was the user's first-ever attempt at this challenge AND it was server-scored. */
  ranked: z.boolean(),
  ratingDelta: z.number().int(),
  awards: z.array(awardSchema),
  profile: profileSchema,
  /** Present when the submission belonged to a battle: authoritative score AFTER this point. */
  battle: battleStateSchema.optional(),
  /** Present for daily submissions: whether THIS submission was the one that got recorded. */
  dailyRecorded: z.boolean().optional(),
});

export const dailyPuzzleSchema = z.object({
  /** UTC date, YYYY-MM-DD. Decided by the server clock when online. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  challenge: publicChallengeSchema,
  alreadyCompleted: z.boolean(),
  /** Positive-only streak: consecutive UTC days completed, ending today or yesterday. */
  currentStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});

export const trackProgressSchema = z.object({
  attempted: z.number().int().min(0),
  correct: z.number().int().min(0),
  /** Distinct challenges ever answered correctly in this track (0..10). */
  mastered: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const progressSummarySchema = z.object({
  profile: profileSchema,
  totalAttempts: z.number().int().min(0),
  totalCorrect: z.number().int().min(0),
  byTrack: z.object({
    rookie: trackProgressSchema,
    challenger: trackProgressSchema,
    strategist: trackProgressSchema,
  }),
  battlesPlayed: z.number().int().min(0),
  battlesWon: z.number().int().min(0),
  dailyCompletions: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});
