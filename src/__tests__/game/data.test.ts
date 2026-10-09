import { CHALLENGES, getChallengeById, PUBLIC_CHALLENGES, toPublicChallenge } from '../../data';
import raw from '../../data/challenges.json';
import { challengeSchema, COURT_LANDMARKS, publicChallengeSchema, TRACKS } from '../../types';

describe('challenge bank', () => {
  it('has exactly 30 challenges, 10 per track, all valid', () => {
    expect(CHALLENGES).toHaveLength(30);
    for (const t of TRACKS) expect(CHALLENGES.filter((c) => c.track === t)).toHaveLength(10);
    for (const c of raw as unknown[]) expect(() => challengeSchema.parse(c)).not.toThrow();
  });

  it('uses the expected ids and is sorted by code-unit order', () => {
    const expected = TRACKS.flatMap((t) => Array.from({ length: 10 }, (_, i) => `${t}-${String(i + 1).padStart(2, '0')}`)).sort();
    expect(CHALLENGES.map((c) => c.id)).toEqual(expected);
    for (let i = 1; i < CHALLENGES.length; i++) expect(CHALLENGES[i - 1]!.id < CHALLENGES[i]!.id).toBe(true);
  });

  it('has unique prompts and a valid correct option with a/b/c/d option ids', () => {
    expect(new Set(CHALLENGES.map((c) => c.prompt)).size).toBe(30);
    for (const c of CHALLENGES) {
      expect(c.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(c.options.some((o) => o.id === c.correctOptionId)).toBe(true);
      expect(new Set(c.options.map((o) => o.label)).size).toBe(4);
    }
  });

  it('has kinds, sources and review flags per track', () => {
    for (const c of CHALLENGES) {
      const kind = { rookie: 'rules', challenger: 'court-position', strategist: 'shot-choice' }[c.track];
      expect(c.kind).toBe(kind);
      expect(c.coachReviewRequired).toBe(c.track !== 'rookie');
      expect(c.sourceUrl).toMatch(/^https:\/\//);
      if (c.track === 'rookie') expect(c.sourceName).toMatch(/ITF Rules of Tennis/);
    }
  });

  it('has a non-degenerate distribution of correct options', () => {
    const counts: Record<string, number> = {};
    for (const c of CHALLENGES) counts[c.correctOptionId] = (counts[c.correctOptionId] ?? 0) + 1;
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(counts[id] ?? 0).toBeGreaterThanOrEqual(5);
      expect(counts[id] ?? 0).toBeLessThanOrEqual(10);
    }
    for (const t of TRACKS) {
      const perTrack = new Set(CHALLENGES.filter((c) => c.track === t).map((c) => c.correctOptionId));
      expect(perTrack.size).toBeGreaterThanOrEqual(3);
    }
  });

  it('places every court point in range, player on the bottom half and opponent on the top', () => {
    const withCourt = CHALLENGES.filter((c) => c.court);
    expect(withCourt.filter((c) => c.track === 'challenger').length).toBeGreaterThanOrEqual(6);
    expect(withCourt.filter((c) => c.track === 'strategist').length).toBeGreaterThanOrEqual(6);
    for (const c of withCourt) {
      const court = c.court!;
      const pts = [court.player, court.opponent, ...(court.ball ? [court.ball] : []), ...(court.recommendedPath ?? [])];
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
      expect(court.player.y).toBeGreaterThan(COURT_LANDMARKS.netY);
      expect(court.opponent.y).toBeLessThan(COURT_LANDMARKS.netY);
      expect(court.caption.length).toBeGreaterThan(30);
    }
  });

  it('has short explanations (1–3 sentences)', () => {
    for (const c of CHALLENGES) {
      const sentences = c.explanation.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences.length).toBeLessThanOrEqual(3);
    }
  });

  it('public view strips answers and passes the public schema', () => {
    expect(PUBLIC_CHALLENGES).toHaveLength(30);
    for (const p of PUBLIC_CHALLENGES) {
      expect(p).not.toHaveProperty('correctOptionId');
      expect(p).not.toHaveProperty('explanation');
      expect(() => publicChallengeSchema.parse(p)).not.toThrow();
    }
    const c = getChallengeById('rookie-01')!;
    expect(toPublicChallenge(c).id).toBe('rookie-01');
    expect(getChallengeById('nope-01')).toBeUndefined();
  });
});
