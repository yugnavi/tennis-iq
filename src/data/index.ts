/**
 * Bundled challenge bank (local read-only fallback + seed source for Supabase).
 * Validated with challengeSchema at import time: invalid data throws.
 */
import { challengeSchema, type Challenge, type PublicChallenge, type Track } from '../types';
import raw from './challenges.json';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function parseChallenges(input: unknown): Challenge[] {
  const parsed = challengeSchema.array().parse(input);
  const ids = new Set(parsed.map((c) => c.id));
  if (ids.size !== parsed.length) throw new Error('Duplicate challenge ids in challenges.json');
  return [...parsed].sort(byId);
}

/** All approved challenges, sorted by id (code-unit order, same as the server's `collate "C"`). */
export const CHALLENGES: Challenge[] = parseChallenges(raw);

export function toPublicChallenge(c: Challenge): PublicChallenge {
  const { correctOptionId: _a, explanation: _b, reviewStatus: _c, coachReviewRequired: _d, ...pub } = c;
  return pub;
}

export const PUBLIC_CHALLENGES: PublicChallenge[] = CHALLENGES.map(toPublicChallenge);

export function getChallengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function getChallengesByTrack(track: Track): Challenge[] {
  return CHALLENGES.filter((c) => c.track === track);
}
