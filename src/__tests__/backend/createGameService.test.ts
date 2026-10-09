import { describe, expect, it, vi } from 'vitest';
import { createGameService, PRACTICE_REASONS } from '../../services';
import { FAILOVER_REASON } from '../../services/resilient';
import { fakeClient, fixtureChallenges, MemoryStorage, profileRow } from './fakes';

const config = { url: 'https://example.supabase.co', anonKey: 'anon-key' };
const base = { challenges: fixtureChallenges(), storage: new MemoryStorage(), isOnline: () => true, timeoutMs: 50 };

const okSubmit = (battle: unknown = null) => ({
  data: {
    is_correct: true, correct_option_id: 'a', explanation: 'Server explanation.', ranked: true,
    user_id: 'u-1', display_name: 'Player', xp: 20, tiq_rating: 515, tiq_delta: 15,
    awards: [{ kind: 'first_correct', xp: 20 }], battle, daily: null,
  },
  error: null,
});

describe('createGameService (never rejects)', () => {
  it('falls back to practice when Supabase is not configured', async () => {
    const svc = await createGameService({ ...base, config: null });
    expect(svc.getStatus()).toEqual({ kind: 'practice', reason: PRACTICE_REASONS.notConfigured });
    expect(await svc.listChallenges('rookie')).toHaveLength(10);
  });

  it('falls back to practice when offline', async () => {
    const svc = await createGameService({ ...base, config, isOnline: () => false });
    expect(svc.getStatus()).toEqual({ kind: 'practice', reason: PRACTICE_REASONS.offline });
  });

  it('falls back to practice when anonymous sign-in fails', async () => {
    const { client } = fakeClient({ signIn: () => ({ data: { session: null }, error: { message: 'Anonymous sign-ins are disabled' } }) });
    const svc = await createGameService({ ...base, config, createClient: () => client });
    expect(svc.getStatus()).toEqual({ kind: 'practice', reason: PRACTICE_REASONS.authFailed });
  });

  it('falls back to practice when the client throws or the server hangs', async () => {
    const throwing = await createGameService({ ...base, config, createClient: () => { throw new Error('boom'); } });
    expect(throwing.getStatus().kind).toBe('practice');

    const { client } = fakeClient({ rpc: { ensure_profile: () => new Promise(() => {}) } });
    const hung = await createGameService({ ...base, config, createClient: () => client });
    expect(hung.getStatus()).toEqual({ kind: 'practice', reason: PRACTICE_REASONS.unreachable });
  });

  it('falls back to practice when migrations are missing (RPC 404)', async () => {
    const { client } = fakeClient({ rpc: { ensure_profile: () => ({ data: null, error: { message: 'Could not find the function', code: 'PGRST202' } }) } });
    const svc = await createGameService({ ...base, config, createClient: () => client });
    expect(svc.getStatus().kind).toBe('practice');
  });

  it('signs in anonymously when no session exists, then is ranked', async () => {
    const { client, calls } = fakeClient({ rpc: { ensure_profile: () => ({ data: profileRow(), error: null }) } });
    const signIn = vi.spyOn(client.auth, 'signInAnonymously');
    const svc = await createGameService({ ...base, config, createClient: () => client });
    expect(svc.getStatus()).toEqual({ kind: 'ranked' });
    expect(signIn).toHaveBeenCalledOnce();
    expect(calls.map((c) => c.name)).toEqual(['ensure_profile']);
  });

  it('restores an existing session without signing in again', async () => {
    const { client } = fakeClient({ session: true, rpc: { ensure_profile: () => ({ data: profileRow(), error: null }) } });
    const signIn = vi.spyOn(client.auth, 'signInAnonymously');
    const svc = await createGameService({ ...base, config, createClient: () => client });
    expect(svc.getStatus().kind).toBe('ranked');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('replaces a stale restored session with a fresh anonymous one', async () => {
    let n = 0;
    const { client } = fakeClient({
      session: true,
      rpc: { ensure_profile: () => (n++ === 0 ? { data: null, error: { message: 'JWT invalid', code: 'PGRST301' } } : { data: profileRow(), error: null }) },
    });
    const signIn = vi.spyOn(client.auth, 'signInAnonymously');
    const svc = await createGameService({ ...base, config, createClient: () => client });
    expect(svc.getStatus().kind).toBe('ranked');
    expect(signIn).toHaveBeenCalledOnce();
  });
});

describe('runtime failover', () => {
  it('switches to practice on a network error, notifies once, and serves the call unranked', async () => {
    let up = true;
    const { client } = fakeClient({
      rpc: {
        ensure_profile: () => ({ data: profileRow(), error: null }),
        submit_answer: () => (up ? okSubmit() : { data: null, error: { message: 'TypeError: Failed to fetch' } }),
      },
    });
    const svc = await createGameService({ ...base, storage: new MemoryStorage(), config, createClient: () => client });
    const listener = vi.fn();
    svc.subscribe(listener);

    expect((await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' })).ranked).toBe(true);
    up = false;
    const r = await svc.submitAnswer({ challengeId: 'rookie-02', optionId: 'a', mode: 'academy' });
    expect(r.ranked).toBe(false);
    expect(r.isCorrect).toBe(true);
    expect(svc.getStatus()).toEqual({ kind: 'practice', reason: FAILOVER_REASON });
    await svc.getProfile();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ kind: 'practice', reason: FAILOVER_REASON });
  });

  it('does not fail over on domain errors', async () => {
    const { client } = fakeClient({
      rpc: {
        ensure_profile: () => ({ data: profileRow(), error: null }),
        submit_answer: () => ({ data: null, error: { message: 'battle not active', code: '22023' } }),
      },
    });
    const svc = await createGameService({ ...base, config, createClient: () => client });
    await expect(svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'battle', battleId: 'b' })).rejects.toMatchObject({ kind: 'domain' });
    expect(svc.getStatus().kind).toBe('ranked');
  });

  it('continues an in-progress server battle locally after failover', async () => {
    let up = true;
    const { client } = fakeClient({
      rpc: {
        ensure_profile: () => ({ data: profileRow(), error: null }),
        start_battle: () => ({ data: { id: 'srv-b', player_points: 0, opponent_points: 0, status: 'active' }, error: null }),
        submit_answer: () =>
          up ? okSubmit({ id: 'srv-b', player_points: 6, opponent_points: 4, status: 'active' }) : { data: null, error: { message: 'Failed to fetch' } },
      },
    });
    const svc = await createGameService({ ...base, storage: new MemoryStorage(), config, createClient: () => client });
    const b = await svc.startBattle();
    expect(b.status).toBe('in_progress');
    await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'battle', battleId: b.battleId });
    up = false;
    const r = await svc.submitAnswer({ challengeId: 'rookie-02', optionId: 'a', mode: 'battle', battleId: b.battleId });
    expect(r.ranked).toBe(false);
    expect(r.battle).toEqual({ battleId: 'srv-b', playerPoints: 7, opponentPoints: 4, status: 'won' });
  });
});
