/**
 * Shared contracts for every agent (Agent 1 owns this directory).
 * Do NOT change these without coordinating through Agent 1.
 */
import type { z } from 'zod';
import type {
  answerResultSchema,
  awardSchema,
  battleStateSchema,
  challengeSchema,
  courtPointSchema,
  courtSceneSchema,
  dailyPuzzleSchema,
  optionSchema,
  playModeSchema,
  profileSchema,
  progressSummarySchema,
  publicChallengeSchema,
  questionKindSchema,
  trackProgressSchema,
  trackSchema,
} from './schemas';

export * from './schemas';

// ---------- Domain ----------
export type Track = z.infer<typeof trackSchema>;
/** Brief §5 calls the track union `Mode`; kept as an alias. */
export type Mode = Track;
export type QuestionKind = z.infer<typeof questionKindSchema>;
export type PlayMode = z.infer<typeof playModeSchema>;
export type CourtPoint = z.infer<typeof courtPointSchema>;
export type CourtScene = z.infer<typeof courtSceneSchema>;
export type ChallengeOption = z.infer<typeof optionSchema>;
export type Challenge = z.infer<typeof challengeSchema>;
export type PublicChallenge = z.infer<typeof publicChallengeSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Award = z.infer<typeof awardSchema>;
export type BattleState = z.infer<typeof battleStateSchema>;
export type AnswerResult = z.infer<typeof answerResultSchema>;
export type DailyPuzzle = z.infer<typeof dailyPuzzleSchema>;
export type TrackProgress = z.infer<typeof trackProgressSchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

export const TRACK_LABELS: Record<Track, { title: string; blurb: string }> = {
  rookie: { title: 'Rookie', blurb: 'Rules & scoring' },
  challenger: { title: 'Challenger', blurb: 'Positioning & geometry' },
  strategist: { title: 'Strategist', blurb: 'Tactics & shot choice' },
};

/**
 * Court coordinate system. All CourtPoints are percentages of the gameplay SVG
 * viewBox (courts/gameplay/*.svg, 360×580). The PLAYER (user) is always on the
 * near/bottom half; the OPPONENT on the far/top half.
 */
export const COURT_LANDMARKS = {
  doublesLeftX: 7.2, // x=26
  singlesLeftX: 16.1, // x=58
  centerX: 50, // x=180
  singlesRightX: 83.9, // x=302
  doublesRightX: 92.8, // x=334
  farBaselineY: 5.5, // y=32
  farServiceLineY: 32.1, // y=186
  netY: 50, // y=290
  nearServiceLineY: 67.9, // y=394
  nearBaselineY: 94.5, // y=548
} as const;

// ---------- Rules constants (server mirrors these in SQL) ----------
export const REWARDS = {
  firstCorrectXp: 20,
  battleCompleteXp: 10,
  dailyCompleteXp: 10,
  ratingStart: 500,
  ratingCorrect: 15,
  ratingIncorrect: -5,
  ratingFloor: 0,
} as const;

export const TIEBREAK = { target: 7, margin: 2 } as const;
export const ACADEMY_SESSION_SIZE = 5;
export const ACADEMY_SESSION_SIZES = [5, 10, 15] as const;
export type AcademySessionSize = (typeof ACADEMY_SESSION_SIZES)[number];
/** Daily index = (daysSinceUnixEpoch(UTC date) * DAILY_STRIDE) mod N over challenges sorted by id (byte order). */
export const DAILY_STRIDE = 7;

// ---------- Service contract (Agent 4 implements, hooks consume) ----------
export type SessionKind = 'ranked' | 'practice';

export type ConnectionStatus = {
  kind: SessionKind;
  /** Human-readable reason when kind === 'practice' (e.g. "Supabase not configured", "Offline"). */
  reason?: string;
};

export type AnswerSubmission = {
  challengeId: string;
  optionId: string;
  mode: PlayMode;
  /** Required when mode === 'battle'. */
  battleId?: string;
};

export type FeedbackKind = 'suggestion' | 'recommendation' | 'bug';

export type FeedbackSubmission = {
  kind: FeedbackKind;
  message: string;
  contact?: string;
  pageUrl?: string;
  userAgent?: string;
};

export type Account =
  | { kind: 'guest' }
  | { kind: 'google'; email?: string; name?: string };

/** Ranked sessions only: upgrade the per-device anonymous identity to a Google account. */
export interface AccountService {
  getAccount(): Promise<Account>;
  /**
   * Redirects to Google. A guest's identity is linked in place so progress is kept;
   * `switchAccount` signs into an existing Google account instead (guest progress stays behind).
   */
  signInWithGoogle(options?: { switchAccount?: boolean }): Promise<void>;
  signOut(): Promise<void>;
}

export interface GameService {
  /** Present only for ranked (Supabase) sessions. */
  account?: AccountService;
  /** Current status; may change from 'ranked' to 'practice' on connection failure. */
  getStatus(): ConnectionStatus;
  subscribe(listener: (status: ConnectionStatus) => void): () => void;

  getProfile(): Promise<Profile>;
  /** Approved, REDACTED challenges (no correct answer / explanation). Sorted by id. */
  listChallenges(track?: Track): Promise<PublicChallenge[]>;
  getDaily(): Promise<DailyPuzzle>;
  /** Server checks correctness, applies idempotent awards, and (for battles) advances the score. */
  submitAnswer(submission: AnswerSubmission): Promise<AnswerResult>;
  startBattle(): Promise<BattleState>;
  /** User exits early. No XP bonus. Idempotent. */
  abandonBattle(battleId: string): Promise<void>;
  getProgress(): Promise<ProgressSummary>;
  submitFeedback(feedback: FeedbackSubmission): Promise<void>;
}

// ---------- Hook contracts (Agent 3 implements in src/hooks/game, Agent 2 consumes in pages) ----------
export type QuestionFlowStatus = 'loading' | 'error' | 'question' | 'feedback';

export type AcademySessionState = {
  status: QuestionFlowStatus | 'recap';
  track: Track;
  questions: PublicChallenge[];
  /** 0-based index of the current question. */
  index: number;
  current?: PublicChallenge;
  /** Result for the current question once answered (status === 'feedback'). */
  lastResult?: AnswerResult;
  /** One entry per answered question, in order (for the recap). */
  results: AnswerResult[];
  submitting: boolean;
  error?: string;
  answer(optionId: string): Promise<void>;
  next(): void;
  restart(): void;
};

export type BattleSummary = {
  won: boolean;
  playerPoints: number;
  opponentPoints: number;
  correctAnswers: number;
  totalAnswers: number;
  xpEarned: number;
  ratingDelta: number;
  awards: Award[];
};

export type TiebreakBattleState = {
  status: QuestionFlowStatus | 'finished';
  score: { player: number; opponent: number };
  /** Whose serve it is for the current point (tie-break serve rotation), for display. */
  server: 'player' | 'opponent';
  pointNumber: number;
  current?: PublicChallenge;
  lastResult?: AnswerResult;
  /** Did the last point go to the player? */
  lastPointWinner?: 'player' | 'opponent';
  summary?: BattleSummary;
  submitting: boolean;
  error?: string;
  answer(optionId: string): Promise<void>;
  next(): void;
  /** Abandon the match (no bonus); safe to call any time. */
  exit(): Promise<void>;
  restart(): void;
};

export type DailyPuzzleState = {
  status: QuestionFlowStatus;
  daily?: DailyPuzzle;
  lastResult?: AnswerResult;
  /** true if this or a previous attempt already recorded today's completion. */
  completedToday: boolean;
  /** Text safe to share (no account identifiers). */
  shareText?: string;
  submitting: boolean;
  error?: string;
  answer(optionId: string): Promise<void>;
  /** Try again for learning (never re-awards). */
  retry(): void;
};
