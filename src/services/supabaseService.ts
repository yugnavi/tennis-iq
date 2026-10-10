/**
 * Ranked GameService backed by Supabase RPCs. Correctness, XP, TIQ, battle score
 * and daily credit are all decided server-side; this layer only calls, validates
 * and maps. Errors are classified into ServiceError('domain' | 'infra').
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnswerSubmission, ConnectionStatus, FeedbackSubmission, GameService, Track } from '../types';
import { ServiceError, withTimeout } from './errors';
import {
  CHALLENGE_COLUMNS,
  mapBattleRow,
  mapChallengeRow,
  mapDailyResult,
  mapProfileRow,
  mapProgressResult,
  mapSubmitResult,
} from './rows';

type PgError = { message: string; code?: string };

/** Our RPCs raise 22023 (invalid_parameter_value) for bad requests; everything else is infra. */
const DOMAIN_ERROR_CODES = new Set(['22023']);

export const REQUEST_TIMEOUT_MS = 8000;

function classify(error: PgError, what: string): ServiceError {
  const kind = error.code && DOMAIN_ERROR_CODES.has(error.code) ? 'domain' : 'infra';
  return new ServiceError(kind, `${what}: ${error.message}`, { cause: error });
}

export function createSupabaseGameService(client: SupabaseClient, timeoutMs = REQUEST_TIMEOUT_MS): GameService {
  async function call<T>(what: string, run: () => PromiseLike<{ data: unknown; error: PgError | null }>, map: (d: unknown) => T): Promise<T> {
    let res: { data: unknown; error: PgError | null };
    try {
      res = await withTimeout(run(), timeoutMs, what);
    } catch (e) {
      throw e instanceof ServiceError ? e : new ServiceError('infra', `${what}: ${String(e)}`, { cause: e });
    }
    if (res.error) throw classify(res.error, what);
    try {
      return map(res.data);
    } catch (e) {
      throw new ServiceError('infra', `${what}: unexpected response shape`, { cause: e });
    }
  }

  const status: ConnectionStatus = { kind: 'ranked' };

  return {
    getStatus: () => status,
    subscribe: () => () => {},

    getProfile: () => call('ensure_profile', () => client.rpc('ensure_profile'), mapProfileRow),

    listChallenges: (track?: Track) =>
      call(
        'list challenges',
        () => {
          const q = client.from('challenges').select(CHALLENGE_COLUMNS);
          return track ? q.eq('track', track) : q;
        },
        (data) => {
          if (!Array.isArray(data)) throw new Error('expected array');
          // Sort client-side by code-unit order to match the daily formula regardless of DB collation.
          return data.map(mapChallengeRow).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        },
      ),

    getDaily: () => call('get_daily', () => client.rpc('get_daily'), mapDailyResult),

    submitAnswer: (s: AnswerSubmission) =>
      call(
        'submit_answer',
        () =>
          client.rpc('submit_answer', {
            p_challenge_id: s.challengeId,
            p_choice_id: s.optionId,
            p_mode: s.mode,
            p_battle_id: s.mode === 'battle' ? (s.battleId ?? null) : null,
          }),
        (d) => mapSubmitResult(d, s),
      ),

    startBattle: () => call('start_battle', () => client.rpc('start_battle'), mapBattleRow),

    abandonBattle: (battleId: string) =>
      call('abandon_battle', () => client.rpc('abandon_battle', { p_battle_id: battleId }), () => undefined),

    getProgress: () => call('get_progress', () => client.rpc('get_progress'), mapProgressResult),

    submitFeedback: (feedback: FeedbackSubmission) =>
      call(
        'submit_feedback',
        () =>
          client.rpc('submit_feedback', {
            p_kind: feedback.kind,
            p_message: feedback.message,
            p_contact: feedback.contact?.trim() || null,
            p_page_url: feedback.pageUrl?.trim() || null,
            p_user_agent: feedback.userAgent?.trim() || null,
          }),
        () => undefined,
      ),
  };
}
