import { describe, expect, it } from 'vitest';
import { ServiceError } from '../../services/errors';
import { mapChallengeRow, mapSubmitResult } from '../../services/rows';
import { createSupabaseGameService } from '../../services/supabaseService';
import { fakeClient } from './fakes';

const submitRow = {
  attempt_id: 'att-1',
  is_correct: true,
  correct_option_id: 'a',
  explanation: 'Because the server says so.',
  ranked: true,
  user_id: 'u-1',
  display_name: 'Player',
  xp: 50,
  tiq_rating: 515,
  xp_delta: 40,
  tiq_delta: 15,
  awards: [
    { kind: 'first_correct', xp: 20 },
    { kind: 'daily_first_completion', xp: 10 },
    { kind: 'battle_complete', xp: 10 },
  ],
  battle: { id: 'b-1', player_points: 3, opponent_points: 2, status: 'active' },
  daily: { puzzle_date: '2026-10-10', first_completion: true },
};

const challengeRow = {
  id: 'rookie-01',
  track: 'rookie',
  kind: 'rules',
  difficulty: 1,
  prompt: 'What is the score called at 40-40?',
  options: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })),
  court: null,
  source_name: 'ITF Rules of Tennis',
  source_url: 'https://www.itftennis.com/',
};

describe('row mapping', () => {
  it('maps submit_answer to the AnswerResult contract', () => {
    const r = mapSubmitResult(submitRow, { challengeId: 'rookie-01', optionId: 'a', mode: 'battle', battleId: 'b-1' });
    expect(r).toMatchObject({
      challengeId: 'rookie-01',
      chosenOptionId: 'a',
      isCorrect: true,
      ranked: true,
      ratingDelta: 15,
      profile: { userId: 'u-1', displayName: 'Player', xp: 50, tiqRating: 515 },
      battle: { battleId: 'b-1', playerPoints: 3, opponentPoints: 2, status: 'in_progress' },
      dailyRecorded: true,
    });
    expect(r.awards).toEqual([
      { kind: 'first_correct', xp: 20, label: 'First correct: +20 XP' },
      { kind: 'daily_complete', xp: 10, label: 'Daily puzzle: +10 XP' },
      { kind: 'battle_complete', xp: 10, label: 'Tie-break complete: +10 XP' },
    ]);
  });

  it('omits battle/dailyRecorded when the server returns null', () => {
    const r = mapSubmitResult({ ...submitRow, battle: null, daily: null }, { challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    expect(r).not.toHaveProperty('battle');
    expect(r).not.toHaveProperty('dailyRecorded');
  });

  it('maps challenge rows and drops a null court', () => {
    const c = mapChallengeRow(challengeRow);
    expect(c).toMatchObject({ id: 'rookie-01', sourceName: 'ITF Rules of Tennis', sourceUrl: 'https://www.itftennis.com/' });
    expect(c).not.toHaveProperty('court');
    expect(c).not.toHaveProperty('correctOptionId');
  });

  it('rejects malformed rows (zod)', () => {
    expect(() => mapSubmitResult({ ...submitRow, xp: 'lots' }, { challengeId: 'x', optionId: 'a', mode: 'academy' })).toThrow();
    expect(() => mapSubmitResult({ ...submitRow, battle: { ...submitRow.battle, status: 'paused' } }, { challengeId: 'x', optionId: 'a', mode: 'battle' })).toThrow();
    expect(() => mapChallengeRow({ ...challengeRow, options: [{ id: 'a', label: 'only one' }] })).toThrow();
    expect(() => mapChallengeRow({ ...challengeRow, id: 'drop table' })).toThrow();
  });
});

describe('createSupabaseGameService', () => {
  it('sends only ids + mode to submit_answer (never client-computed scores)', async () => {
    const { client, calls } = fakeClient({ rpc: { submit_answer: () => ({ data: submitRow, error: null }) } });
    const svc = createSupabaseGameService(client);
    await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'battle', battleId: 'b-1' });
    expect(calls).toEqual([
      { name: 'submit_answer', args: { p_challenge_id: 'rookie-01', p_choice_id: 'a', p_mode: 'battle', p_battle_id: 'b-1' } },
    ]);
  });

  it('classifies 22023 as a domain error and anything else as infra', async () => {
    const { client } = fakeClient({
      rpc: {
        submit_answer: () => ({ data: null, error: { message: 'battle not active', code: '22023' } }),
        get_daily: () => ({ data: null, error: { message: 'Failed to fetch', code: '' } }),
        get_progress: () => ({ data: { nonsense: true }, error: null }),
      },
    });
    const svc = createSupabaseGameService(client);
    await expect(svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' })).rejects.toMatchObject({ kind: 'domain' });
    await expect(svc.getDaily()).rejects.toMatchObject({ kind: 'infra' });
    await expect(svc.getProgress()).rejects.toBeInstanceOf(ServiceError);
    await expect(svc.getProgress()).rejects.toMatchObject({ kind: 'infra' });
  });

  it('times out hung requests as infra errors', async () => {
    const { client } = fakeClient({ rpc: { ensure_profile: () => new Promise(() => {}) } });
    await expect(createSupabaseGameService(client, 20).getProfile()).rejects.toMatchObject({ kind: 'infra' });
  });

  it('lists challenges sorted by code-unit id order', async () => {
    const rows = ['strategist-01', 'challenger-02', 'rookie-10', 'challenger-01'].map((id) => ({ ...challengeRow, id }));
    const { client } = fakeClient({ select: () => ({ data: rows, error: null }) });
    const list = await createSupabaseGameService(client).listChallenges();
    expect(list.map((c) => c.id)).toEqual(['challenger-01', 'challenger-02', 'rookie-10', 'strategist-01']);
  });
});
