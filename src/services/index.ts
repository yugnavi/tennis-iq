/**
 * Entry point: `createGameService()` resolves to a ranked Supabase-backed service
 * when configured and reachable, otherwise to a clearly labeled practice service.
 * It never rejects; every failure path ends in practice mode with a reason.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CHALLENGES } from '../data';
import { createSupabaseClient, readSupabaseConfig, type SupabaseConfig } from '../lib/supabase/client';
import type { Challenge, GameService } from '../types';
import { withTimeout } from './errors';
import { createAccountService } from './account';
import { createPracticeService, type StorageLike } from './practiceService';
import { createResilientService } from './resilient';
import { createSupabaseGameService, REQUEST_TIMEOUT_MS } from './supabaseService';

export { ServiceError, isDomainError } from './errors';
export { readOAuthError } from './account';

export const PRACTICE_REASONS = {
  notConfigured: 'Ranked play is not set up on this site, so you are playing unranked practice.',
  offline: 'You appear to be offline, so you are playing unranked practice.',
  authFailed: 'Could not start a ranked session, so you are playing unranked practice.',
  unreachable: 'Could not reach the server, so you are playing unranked practice.',
} as const;

export type GameServiceDeps = {
  config?: SupabaseConfig | null;
  createClient?: (config: SupabaseConfig) => SupabaseClient;
  challenges?: Challenge[];
  storage?: StorageLike | null;
  isOnline?: () => boolean;
  now?: () => Date;
  timeoutMs?: number;
};

export async function createGameService(deps: GameServiceDeps = {}): Promise<GameService> {
  const makePractice = (reason: string) =>
    createPracticeService({ reason, challenges: deps.challenges ?? CHALLENGES, storage: deps.storage, now: deps.now });

  try {
    const config = deps.config === undefined ? readSupabaseConfig() : deps.config;
    if (!config) return makePractice(PRACTICE_REASONS.notConfigured);

    const online = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
    if (!online()) return makePractice(PRACTICE_REASONS.offline);

    const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const client = (deps.createClient ?? createSupabaseClient)(config);

    const signInAnonymously = async () => {
      const res = await withTimeout(client.auth.signInAnonymously(), timeoutMs, 'signInAnonymously');
      return !res.error && !!res.data.session;
    };

    // Restore the persisted anonymous session, or create a new per-device identity.
    const { data } = await withTimeout(client.auth.getSession(), timeoutMs, 'getSession');
    const restored = !!data.session;
    if (!restored && !(await signInAnonymously())) return makePractice(PRACTICE_REASONS.authFailed);

    // Prove the backend (migrations + RPC grants) actually works before promising ranked play.
    const ranked = createSupabaseGameService(client, timeoutMs);
    try {
      await ranked.getProfile();
    } catch (e) {
      // A restored session can be stale (user deleted, project reset): start a fresh identity once.
      if (!restored) throw e;
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      if (!(await signInAnonymously())) return makePractice(PRACTICE_REASONS.authFailed);
      await ranked.getProfile();
    }

    return { ...createResilientService(ranked, makePractice), account: createAccountService(client) };
  } catch {
    return makePractice(PRACTICE_REASONS.unreachable);
  }
}
