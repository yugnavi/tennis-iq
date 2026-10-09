import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from '../../app/session';
import { useAcademySession, useDailyPuzzle, useTiebreakBattle } from '../../hooks/game';
import type { GameService } from '../../types';
import { correctOptionFor, createFakeService, wrongOptionFor } from './fakeService';

const wrapperFor = (service: GameService) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <SessionProvider service={service}>{children}</SessionProvider>;
  };

beforeEach(() => {
  localStorage.clear();
});

describe('useAcademySession', () => {
  it('runs 5 unique questions from the track to the recap', async () => {
    const fake = createFakeService();
    const { result } = renderHook(() => ({ a: useAcademySession('challenger'), s: useSession() }), {
      wrapper: wrapperFor(fake),
    });
    await waitFor(() => expect(result.current.a.status).toBe('question'));
    expect(result.current.a.questions).toHaveLength(5);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const q = result.current.a.current!;
      expect(q.track).toBe('challenger');
      seen.push(q.id);
      const opt = i % 2 === 0 ? correctOptionFor(q.id) : wrongOptionFor(q.id);
      await act(() => result.current.a.answer(opt));
      expect(result.current.a.status).toBe('feedback');
      expect(result.current.a.lastResult?.isCorrect).toBe(i % 2 === 0);
      act(() => result.current.a.next());
    }
    expect(new Set(seen).size).toBe(5);
    expect(result.current.a.status).toBe('recap');
    expect(result.current.a.results.map((r) => r.isCorrect)).toEqual([true, false, true, false, true]);
    expect(fake.calls.submit.every((s) => s.mode === 'academy')).toBe(true);
    // Profile pushed into the session from the server result (3 first-correct awards).
    expect(result.current.s.ready && result.current.s.profile?.xp).toBe(60);

    // Restart rotates to a different set via the per-track localStorage counter.
    act(() => result.current.a.restart());
    await waitFor(() => expect(result.current.a.status).toBe('question'));
    const second = result.current.a.questions.map((q) => q.id);
    expect(second.some((id) => !seen.includes(id))).toBe(true);
  });

  it('guards against double submission', async () => {
    const fake = createFakeService();
    const { result } = renderHook(() => useAcademySession('rookie'), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(result.current.status).toBe('question'));
    const id = result.current.current!.id;
    await act(async () => {
      const p1 = result.current.answer(correctOptionFor(id));
      const p2 = result.current.answer(correctOptionFor(id));
      await Promise.all([p1, p2]);
    });
    expect(fake.calls.submit).toHaveLength(1);
  });

  it('surfaces load errors', async () => {
    const fake = createFakeService();
    fake.listChallenges = async () => {
      throw new Error('offline');
    };
    const { result } = renderHook(() => useAcademySession('rookie'), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('offline');
  });
});

async function playBattle(style: 'practice' | 'server', answerCorrectly: (point: number) => boolean) {
  const fake = createFakeService({ style });
  const hook = renderHook(() => useTiebreakBattle(), { wrapper: wrapperFor(fake) });
  const { result } = hook;
  await waitFor(() => expect(result.current.status).toBe('question'));
  let guard = 0;
  while (result.current.status !== 'finished' && guard++ < 100) {
    const q = result.current.current!;
    const point = result.current.pointNumber;
    await act(() => result.current.answer(answerCorrectly(point) ? correctOptionFor(q.id) : wrongOptionFor(q.id)));
    if (result.current.status === 'feedback') act(() => result.current.next());
  }
  return { fake, ...hook };
}

describe('useTiebreakBattle', () => {
  it.each(['practice', 'server'] as const)('%s: reaches 7–0 and finishes', async (style) => {
    const { result, fake } = await playBattle(style, () => true);
    expect(result.current.status).toBe('finished');
    expect(result.current.score).toEqual({ player: 7, opponent: 0 });
    const summary = result.current.summary!;
    expect(summary).toMatchObject({ won: true, playerPoints: 7, opponentPoints: 0, correctAnswers: 7, totalAnswers: 7 });
    expect(summary.ratingDelta).toBe(7 * 15);
    expect(summary.xpEarned).toBe(7 * 20 + (style === 'server' ? 10 : 0));
    expect(fake.calls.submit.every((s) => s.mode === 'battle' && s.battleId === 'b1')).toBe(true);
    // Exit after finishing does not abandon.
    await act(() => result.current.exit());
    expect(fake.calls.abandon).toEqual([]);
  });

  it.each(['practice', 'server'] as const)('%s: plays past 6–6 and needs a 2-point lead', async (style) => {
    // P,O alternate to 6–6, then 7–7, then the opponent wins two in a row: 7–9.
    const pattern = (n: number) => (n <= 14 ? n % 2 === 1 : false);
    const { result } = await playBattle(style, pattern);
    expect(result.current.status).toBe('finished');
    expect(result.current.score).toEqual({ player: 7, opponent: 9 });
    expect(result.current.summary?.won).toBe(false);
  });

  it('tracks the serve rotation and point number', async () => {
    const fake = createFakeService();
    const { result } = renderHook(() => useTiebreakBattle(), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(result.current.status).toBe('question'));
    const servers: string[] = [];
    for (let i = 0; i < 4; i++) {
      servers.push(result.current.server);
      expect(result.current.pointNumber).toBe(i + 1);
      await act(() => result.current.answer(correctOptionFor(result.current.current!.id)));
      expect(result.current.lastPointWinner).toBe('player');
      act(() => result.current.next());
    }
    expect(servers).toEqual(['player', 'opponent', 'opponent', 'player']);
  });

  it('does not repeat a question during a battle', async () => {
    const { fake } = await playBattle('practice', (n) => n % 2 === 0 || n > 12);
    const ids = fake.calls.submit.map((s) => s.challengeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('under StrictMode, a stale battle start is abandoned and play uses one battle', async () => {
    const fake = createFakeService({ style: 'server' });
    const { result } = renderHook(() => useTiebreakBattle(), { wrapper: wrapperFor(fake), reactStrictMode: true });
    await waitFor(() => expect(result.current.status).toBe('question'));
    await waitFor(() => expect(fake.calls.abandon.length).toBe(fake.calls.startBattle - 1));
    await act(() => result.current.answer(correctOptionFor(result.current.current!.id)));
    const used = fake.calls.submit[0]!.battleId!;
    expect(fake.calls.abandon).not.toContain(used);
    expect(result.current.score).toEqual({ player: 1, opponent: 0 });
  });

  it('exit abandons an unfinished battle once, even if called twice', async () => {
    const fake = createFakeService({ style: 'server' });
    const { result } = renderHook(() => useTiebreakBattle(), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(result.current.status).toBe('question'));
    await act(async () => {
      await result.current.exit();
      await result.current.exit();
    });
    expect(fake.calls.abandon).toEqual(['b1']);
  });

  it('stops at the safety cap if the service never decides a winner', async () => {
    const fake = createFakeService({ style: 'server' });
    const original = fake.submitAnswer;
    let n = 0;
    fake.submitAnswer = async (sub) => {
      const r = await original(sub);
      n++;
      // Pathological server: always in progress, alternating score that never separates.
      return { ...r, battle: { battleId: 'b1', playerPoints: Math.ceil(n / 2), opponentPoints: Math.floor(n / 2), status: 'in_progress' } };
    };
    const { result } = await (async () => {
      const hook = renderHook(() => useTiebreakBattle(), { wrapper: wrapperFor(fake) });
      await waitFor(() => expect(hook.result.current.status).toBe('question'));
      let guard = 0;
      while (hook.result.current.status !== 'finished' && guard++ < 200) {
        await act(() => hook.result.current.answer('a'));
        if (hook.result.current.status === 'feedback') act(() => hook.result.current.next());
      }
      return hook;
    })();
    expect(result.current.status).toBe('finished');
    expect(result.current.score.player + result.current.score.opponent).toBe(60);
    expect(fake.calls.abandon).toEqual(['b1']);
  });
});

describe('useDailyPuzzle', () => {
  it('answers, records completion, extends the streak and supports retry', async () => {
    const fake = createFakeService();
    const { result } = renderHook(() => useDailyPuzzle(), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(result.current.status).toBe('question'));
    expect(result.current.completedToday).toBe(false);
    const id = result.current.daily!.challenge.id;
    await act(() => result.current.answer(correctOptionFor(id)));
    expect(result.current.status).toBe('feedback');
    expect(result.current.completedToday).toBe(true);
    expect(result.current.daily?.currentStreak).toBe(3);
    expect(result.current.shareText).toContain('2026-10-09');
    expect(result.current.shareText).not.toContain('fake');
    expect(fake.calls.submit[0]).toMatchObject({ mode: 'daily', challengeId: id });

    act(() => result.current.retry());
    expect(result.current.status).toBe('question');
    await act(() => result.current.answer(wrongOptionFor(id)));
    expect(result.current.completedToday).toBe(true);
    expect(result.current.daily?.currentStreak).toBe(3);
  });

  it('reports completedToday from a previous attempt', async () => {
    const fake = createFakeService({ daily: { alreadyCompleted: true }, dailyRecorded: false });
    const { result } = renderHook(() => useDailyPuzzle(), { wrapper: wrapperFor(fake) });
    await waitFor(() => expect(result.current.status).toBe('question'));
    expect(result.current.completedToday).toBe(true);
  });
});
