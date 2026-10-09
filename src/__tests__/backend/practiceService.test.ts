import { describe, expect, it } from 'vitest';
import { pickDailyChallenge } from '../../game/daily';
import { createPracticeService, PRACTICE_STORAGE_KEY } from '../../services/practiceService';
import { fixtureChallenges, MemoryStorage, throwingStorage } from './fakes';

const at = (iso: string) => () => new Date(iso);

function setup(storage: MemoryStorage | typeof throwingStorage | null = new MemoryStorage(), now = at('2026-10-10T12:00:00Z')) {
  return createPracticeService({ reason: 'Testing practice', challenges: fixtureChallenges(), storage, now });
}

describe('practice service', () => {
  it('is labeled practice and every result is unranked', async () => {
    const svc = setup();
    expect(svc.getStatus()).toEqual({ kind: 'practice', reason: 'Testing practice' });
    const r = await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    expect(r.ranked).toBe(false);
  });

  it('awards first-correct XP once and moves rating only on the first attempt', async () => {
    const svc = setup();
    const first = await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    expect(first.awards).toEqual([{ kind: 'first_correct', xp: 20, label: 'First correct: +20 XP' }]);
    expect(first.ratingDelta).toBe(15);
    expect(first.profile).toMatchObject({ xp: 20, tiqRating: 515 });

    const again = await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'battle' as const, battleId: (await svc.startBattle()).battleId });
    expect(again.awards).toEqual([]);
    expect(again.ratingDelta).toBe(0);
    expect(again.profile.xp).toBe(20);

    const wrongFirst = await svc.submitAnswer({ challengeId: 'rookie-02', optionId: 'b', mode: 'academy' });
    expect(wrongFirst.ratingDelta).toBe(-5);
    const laterRight = await svc.submitAnswer({ challengeId: 'rookie-02', optionId: 'a', mode: 'academy' });
    expect(laterRight.ratingDelta).toBe(0);
    expect(laterRight.awards.map((a) => a.kind)).toEqual(['first_correct']);
  });

  it('does not double-award under concurrent duplicate submissions', async () => {
    const svc = setup();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => svc.submitAnswer({ challengeId: 'strategist-03', optionId: 'a', mode: 'academy' })),
    );
    expect(results.flatMap((r) => r.awards)).toHaveLength(1);
    expect((await svc.getProfile()).xp).toBe(20);
  });

  it('floors rating at 0', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ userId: 'local-x', xp: 0, tiqRating: 2, challenges: {}, dailies: {}, battles: [], battleStats: { played: 0, won: 0 } }),
    );
    const r = await setup(storage).submitAnswer({ challengeId: 'rookie-01', optionId: 'b', mode: 'academy' });
    expect(r.profile.tiqRating).toBe(0);
    expect(r.ratingDelta).toBe(-2);
  });

  it('daily: same puzzle all day, +10 once even if wrong, rejects other challenges', async () => {
    const svc = setup();
    const morning = await setup(null, at('2026-10-10T00:00:01Z')).getDaily();
    const daily = await svc.getDaily();
    expect(daily.date).toBe('2026-10-10');
    expect(daily.challenge.id).toBe(morning.challenge.id);
    const sorted = fixtureChallenges().sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(daily.challenge.id).toBe(pickDailyChallenge(sorted, '2026-10-10').id);
    // Same answer the SQL test asserts for daily_challenge_id('2026-10-10') on the same fixture ids.
    expect(daily.challenge.id).toBe('rookie-03');
    expect(daily.challenge).not.toHaveProperty('correctOptionId');

    const wrong = await svc.submitAnswer({ challengeId: daily.challenge.id, optionId: 'b', mode: 'daily' });
    expect(wrong.dailyRecorded).toBe(true);
    expect(wrong.awards).toEqual([{ kind: 'daily_complete', xp: 10, label: 'Daily puzzle: +10 XP' }]);
    const retry = await svc.submitAnswer({ challengeId: daily.challenge.id, optionId: 'a', mode: 'daily' });
    expect(retry.dailyRecorded).toBe(false);
    expect(retry.awards.map((a) => a.kind)).toEqual(['first_correct']);
    expect(await svc.getDaily()).toMatchObject({ alreadyCompleted: true, currentStreak: 1, bestStreak: 1 });

    const other = daily.challenge.id === 'rookie-01' ? 'rookie-02' : 'rookie-01';
    await expect(svc.submitAnswer({ challengeId: other, optionId: 'a', mode: 'daily' })).rejects.toMatchObject({ kind: 'domain' });
  });

  it('daily puzzle changes by UTC date', async () => {
    const a = await setup(null, at('2026-10-10T23:59:59Z')).getDaily();
    const b = await setup(null, at('2026-10-11T00:00:00Z')).getDaily();
    expect(a.date).toBe('2026-10-10');
    expect(b.date).toBe('2026-10-11');
    expect(a.challenge.id).not.toBe(b.challenge.id);
  });

  it('battle: no win at 7-6, ends at 8-6 with a single +10 bonus, then rejects answers', async () => {
    const svc = setup();
    const { battleId } = await svc.startBattle();
    const ids = fixtureChallenges().map((c) => c.id);
    let last;
    const seq = 'WWWWWWLLLLLLW';
    for (let i = 0; i < seq.length; i++) {
      last = await svc.submitAnswer({ challengeId: ids[i]!, optionId: seq[i] === 'W' ? 'a' : 'b', mode: 'battle', battleId });
    }
    expect(last?.battle).toEqual({ battleId, playerPoints: 7, opponentPoints: 6, status: 'in_progress' });
    last = await svc.submitAnswer({ challengeId: ids[20]!, optionId: 'a', mode: 'battle', battleId });
    expect(last.battle?.status).toBe('won');
    expect(last.awards.filter((a) => a.kind === 'battle_complete')).toHaveLength(1);
    await expect(svc.submitAnswer({ challengeId: ids[21]!, optionId: 'a', mode: 'battle', battleId })).rejects.toMatchObject({ kind: 'domain' });
    expect(await svc.getProgress()).toMatchObject({ battlesPlayed: 1, battlesWon: 1 });
  });

  it('abandon is idempotent and gives no bonus; a new battle abandons the old one', async () => {
    const svc = setup();
    const b1 = await svc.startBattle();
    const b2 = await svc.startBattle();
    await expect(svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'battle', battleId: b1.battleId })).rejects.toMatchObject({ kind: 'domain' });
    await svc.abandonBattle(b2.battleId);
    await svc.abandonBattle(b2.battleId);
    expect(await svc.getProgress()).toMatchObject({ battlesPlayed: 0, profile: { xp: 0 } });
  });

  it('adopts a server battle score after failover', async () => {
    const svc = setup();
    svc.adoptBattle({ battleId: 'server-1', playerPoints: 6, opponentPoints: 5, status: 'in_progress' });
    const r = await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'battle', battleId: 'server-1' });
    expect(r.battle).toEqual({ battleId: 'server-1', playerPoints: 7, opponentPoints: 5, status: 'won' });
  });

  it('persists progress across reloads', async () => {
    const storage = new MemoryStorage();
    await setup(storage).submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    const reloaded = setup(storage);
    expect((await reloaded.getProfile()).xp).toBe(20);
    const again = await reloaded.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    expect(again.awards).toEqual([]);
  });

  it('keeps working when storage throws or is corrupt', async () => {
    const svc = setup(throwingStorage);
    const r = await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    expect(r.profile.xp).toBe(20);

    const corrupt = new MemoryStorage();
    corrupt.setItem(PRACTICE_STORAGE_KEY, '{"xp": -999');
    expect((await setup(corrupt).getProfile()).xp).toBe(0);
    corrupt.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ userId: 'x', xp: 99999999.5 }));
    expect((await setup(corrupt).getProfile()).xp).toBe(0);
  });

  it('rejects unknown challenges and foreign options as domain errors', async () => {
    const svc = setup();
    await expect(svc.submitAnswer({ challengeId: 'nope-01', optionId: 'a', mode: 'academy' })).rejects.toMatchObject({ kind: 'domain' });
    await expect(svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'z', mode: 'academy' })).rejects.toMatchObject({ kind: 'domain' });
  });

  it('reports per-track progress', async () => {
    const svc = setup();
    await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'a', mode: 'academy' });
    await svc.submitAnswer({ challengeId: 'rookie-01', optionId: 'b', mode: 'academy' });
    await svc.submitAnswer({ challengeId: 'challenger-01', optionId: 'b', mode: 'academy' });
    const p = await svc.getProgress();
    expect(p.byTrack.rookie).toEqual({ attempted: 2, correct: 1, mastered: 1, total: 10 });
    expect(p.byTrack.challenger).toEqual({ attempted: 1, correct: 0, mastered: 0, total: 10 });
    expect(p).toMatchObject({ totalAttempts: 3, totalCorrect: 1 });
  });
});
