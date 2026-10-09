/** Test doubles for backend tests: synthetic challenges, fake storage, scripted Supabase client. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { TRACKS, type Challenge } from '../../types';

/** 30 valid challenges; the correct option is always 'a'. */
export function fixtureChallenges(): Challenge[] {
  return TRACKS.flatMap((track) =>
    Array.from({ length: 10 }, (_, i): Challenge => ({
      id: `${track}-${String(i + 1).padStart(2, '0')}`,
      track,
      kind: 'rules',
      difficulty: 1,
      prompt: `Fixture prompt for ${track} ${i + 1}`,
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: `Option ${id}` })),
      correctOptionId: 'a',
      explanation: 'Fixture explanation long enough to validate.',
      sourceName: 'ITF Rules of Tennis',
      sourceUrl: 'https://www.itftennis.com/',
      reviewStatus: 'approved',
      coachReviewRequired: false,
    })),
  );
}

export class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

export const throwingStorage = {
  getItem(): string | null {
    throw new Error('SecurityError: storage disabled');
  },
  setItem(): void {
    throw new Error('QuotaExceededError');
  },
};

type Result = { data: unknown; error: { message: string; code?: string } | null };
type RpcHandler = (args?: Record<string, unknown>) => Result | Promise<Result>;

export type FakeClientOptions = {
  session?: boolean;
  signIn?: () => Result | Promise<Result>;
  rpc?: Record<string, RpcHandler>;
  select?: () => Result | Promise<Result>;
};

export function profileRow(overrides: Record<string, unknown> = {}) {
  return { user_id: 'u-1', display_name: 'Player', xp: 0, tiq_rating: 500, created_at: '', updated_at: '', ...overrides };
}

/** Minimal scripted stand-in for the parts of SupabaseClient the services use. */
export function fakeClient(opts: FakeClientOptions = {}) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  let hasSession = opts.session ?? false;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: hasSession ? { access_token: 't' } : null }, error: null }),
      signInAnonymously: async () => {
        const r = opts.signIn ? await opts.signIn() : { data: { session: { access_token: 't' } }, error: null };
        if (!r.error) hasSession = true;
        return r;
      },
      signOut: async () => {
        hasSession = false;
        return { error: null };
      },
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      const handler = opts.rpc?.[name];
      return Promise.resolve(handler ? handler(args) : { data: null, error: { message: `no handler for ${name}` } });
    },
    from: (table: string) => {
      const run = () => {
        calls.push({ name: `from:${table}` });
        return Promise.resolve(opts.select ? opts.select() : { data: [], error: null });
      };
      const builder = {
        select: () => builder,
        eq: () => builder,
        then: (res: (v: Result) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}
