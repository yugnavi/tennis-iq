import { pickAcademyQuestions } from '../../game/academy';
import { createBattleQueue, createSeededBattleQueue } from '../../game/battleQueue';
import { mulberry32, seededShuffle } from '../../game/random';
import { CHALLENGES } from '../../data';
import { TRACKS } from '../../types';

describe('pickAcademyQuestions', () => {
  it.each(TRACKS)('picks 5 unique %s questions from that track only', (track) => {
    const pool = CHALLENGES.filter((c) => c.track === track);
    for (let seed = 0; seed < 20; seed++) {
      const picked = pickAcademyQuestions(pool, seed);
      expect(picked).toHaveLength(5);
      expect(new Set(picked.map((c) => c.id)).size).toBe(5);
      expect(picked.every((c) => c.track === track)).toBe(true);
    }
  });

  it('is deterministic per seed and independent of input order', () => {
    const pool = CHALLENGES.filter((c) => c.track === 'rookie');
    const ids = (s: number, p = pool) => pickAcademyQuestions(p, s).map((c) => c.id);
    expect(ids(3)).toEqual(ids(3));
    expect(ids(3, [...pool].reverse())).toEqual(ids(3));
  });

  it('rotates: consecutive seeds 2k and 2k+1 cover the whole 10-question track', () => {
    const pool = CHALLENGES.filter((c) => c.track === 'strategist');
    for (const k of [0, 1, 7]) {
      const both = [...pickAcademyQuestions(pool, 2 * k), ...pickAcademyQuestions(pool, 2 * k + 1)];
      expect(new Set(both.map((c) => c.id)).size).toBe(10);
    }
    expect(pickAcademyQuestions(pool, 0).map((c) => c.id)).not.toEqual(pickAcademyQuestions(pool, 2).map((c) => c.id));
  });

  it('handles small pools and empty pools', () => {
    expect(pickAcademyQuestions(CHALLENGES.slice(0, 3), 1)).toHaveLength(3);
    expect(pickAcademyQuestions([], 1)).toEqual([]);
  });
});

describe('random', () => {
  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('seededShuffle is a permutation', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i);
    const out = seededShuffle(arr, 9);
    expect([...out].sort((x, y) => x - y)).toEqual(arr);
    expect(out).not.toEqual(arr);
  });
});

describe('battle queue', () => {
  it('serves the whole pool without repeats before refilling', () => {
    const q = createSeededBattleQueue(CHALLENGES, 1);
    const first = Array.from({ length: 30 }, () => q.next().id);
    expect(new Set(first).size).toBe(30);
  });

  it('never repeats a question immediately across refills', () => {
    for (let seed = 0; seed < 50; seed++) {
      const q = createSeededBattleQueue(CHALLENGES.slice(0, 4), seed);
      let prev = '';
      for (let i = 0; i < 40; i++) {
        const id = q.next().id;
        expect(id).not.toBe(prev);
        prev = id;
      }
    }
  });

  it('works with a single-question pool and rejects an empty one', () => {
    const q = createBattleQueue(CHALLENGES.slice(0, 1));
    expect(q.next().id).toBe(q.next().id);
    expect(() => createBattleQueue([])).toThrow();
  });
});
