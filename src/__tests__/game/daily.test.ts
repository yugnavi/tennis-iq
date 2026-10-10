import { computeStreaks, dailyChallengeIndex, daysSinceEpoch, pickDailyChallenge, utcDateString } from '../../game/daily';
import { buildDailyShareText } from '../../game/share';
import { CHALLENGES } from '../../data';

describe('daily puzzle selection', () => {
  it('matches known vectors', () => {
    expect(dailyChallengeIndex('1970-01-01', 30)).toBe(0);
    expect(dailyChallengeIndex('1970-01-02', 30)).toBe(7);
    expect(dailyChallengeIndex('1970-01-05', 30)).toBe(28);
    expect(dailyChallengeIndex('1970-01-06', 30)).toBe(5); // 35 mod 30
    // 2026-10-09: 56 years since 1970 incl. 14 leap days (1972..2024) => 20454 days to 2026-01-01,
    // + 273 days (Jan..Sep) + 8 => d = 20735. 20735 * 7 = 145145; 145145 mod 30 = 5.
    expect(daysSinceEpoch('2026-10-09')).toBe(20735);
    expect(dailyChallengeIndex('2026-10-09', 30)).toBe(5);
  });

  it('gives the same pick for the same date and different picks for adjacent dates', () => {
    const a = pickDailyChallenge(CHALLENGES, '2026-10-09');
    expect(pickDailyChallenge(CHALLENGES, '2026-10-09')).toBe(a);
    expect(pickDailyChallenge(CHALLENGES, '2026-10-10').id).not.toBe(a.id);
    expect(pickDailyChallenge(CHALLENGES, '2026-10-08').id).not.toBe(a.id);
    expect(a.id).toBe(CHALLENGES[dailyChallengeIndex('2026-10-09', CHALLENGES.length)]!.id);
  });

  it('cycles through all 600 challenges over 600 consecutive days (stride 7 is coprime with 600)', () => {
    const start = daysSinceEpoch('2026-01-01');
    const ids = new Set<string>();
    for (let i = 0; i < 600; i++) ids.add(pickDailyChallenge(CHALLENGES, utcDateString(new Date((start + i) * 86_400_000))).id);
    expect(ids.size).toBe(600);
  });

  it('uses UTC day boundaries', () => {
    expect(utcDateString(new Date('2026-10-09T23:59:59.999Z'))).toBe('2026-10-09');
    expect(utcDateString(new Date('2026-10-10T00:00:00.000Z'))).toBe('2026-10-10');
    // A local-time offset never changes the UTC date.
    expect(utcDateString(new Date('2026-10-09T23:30:00-05:00'))).toBe('2026-10-10');
  });

  it('rejects invalid dates and counts', () => {
    expect(() => dailyChallengeIndex('2026-02-30', 30)).toThrow();
    expect(() => dailyChallengeIndex('20261009', 30)).toThrow();
    expect(() => dailyChallengeIndex('2026-10-09', 0)).toThrow();
  });
});

describe('computeStreaks', () => {
  const today = '2026-10-09';
  it('is zero with no history', () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, best: 0 });
  });
  it('counts a run ending today', () => {
    expect(computeStreaks(['2026-10-07', '2026-10-08', '2026-10-09'], today)).toEqual({ current: 3, best: 3 });
  });
  it('keeps a run ending yesterday alive', () => {
    expect(computeStreaks(['2026-10-07', '2026-10-08'], today)).toEqual({ current: 2, best: 2 });
  });
  it('resets current (not best) after a missed day', () => {
    expect(computeStreaks(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-07'], today)).toEqual({
      current: 0,
      best: 4,
    });
  });
  it('starts a fresh count after a gap while keeping the historical best', () => {
    expect(computeStreaks(['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-09'], today)).toEqual({ current: 1, best: 3 });
  });
  it('handles month and year boundaries', () => {
    expect(computeStreaks(['2025-12-31', '2026-01-01'], '2026-01-01')).toEqual({ current: 2, best: 2 });
  });
});

describe('buildDailyShareText', () => {
  it('includes date and result but no identifiers', () => {
    const text = buildDailyShareText('2026-10-09', true, 3);
    expect(text).toContain('2026-10-09');
    expect(text).toContain('3 days');
    expect(text).not.toMatch(/user|id|@|uuid/i);
    expect(buildDailyShareText('2026-10-09', false, 0)).not.toContain('streak');
  });
});
