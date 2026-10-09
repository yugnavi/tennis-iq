import { useCallback, useEffect, useRef } from 'react';
import { useReadySession } from '../../app/session';
import { buildDailyShareText } from '../../game/share';
import type { AnswerResult, DailyPuzzle, DailyPuzzleState } from '../../types';
import { errorMessage, useSyncStore } from './shared';

type Internal = {
  status: DailyPuzzleState['status'];
  daily?: DailyPuzzle;
  lastResult?: AnswerResult;
  firstResult?: AnswerResult;
  completedToday: boolean;
  shareText?: string;
  submitting: boolean;
  error?: string;
};

const initial = (): Internal => ({ status: 'loading', completedToday: false, submitting: false });

export function useDailyPuzzle(): DailyPuzzleState {
  const { service, setProfile } = useReadySession();
  const [s, get, set] = useSyncStore(initial);
  const gen = useRef(0);

  useEffect(() => {
    const myGen = ++gen.current;
    set(initial());
    service
      .getDaily()
      .then((daily) => {
        if (myGen !== gen.current) return;
        set({ ...initial(), status: 'question', daily, completedToday: daily.alreadyCompleted });
      })
      .catch((e: unknown) => {
        if (myGen === gen.current) set({ ...get(), status: 'error', error: errorMessage(e) });
      });
    return () => {
      gen.current++;
    };
  }, [service, get, set]);

  const answer = useCallback(
    async (optionId: string) => {
      const cur = get();
      if (cur.submitting || cur.status !== 'question' || !cur.daily) return;
      const myGen = gen.current;
      set({ ...cur, submitting: true });
      try {
        const result = await service.submitAnswer({ challengeId: cur.daily.challenge.id, optionId, mode: 'daily' });
        setProfile(result.profile);
        if (myGen !== gen.current) return;
        const prev = get();
        const daily = prev.daily as DailyPuzzle;
        const newlyRecorded = !daily.alreadyCompleted && result.dailyRecorded === true;
        const completedToday = daily.alreadyCompleted || result.dailyRecorded === true;
        // Positive-only streak: today's first completion extends the run that ended yesterday.
        const currentStreak = newlyRecorded ? daily.currentStreak + 1 : daily.currentStreak;
        const updated: DailyPuzzle = {
          ...daily,
          alreadyCompleted: completedToday,
          currentStreak,
          bestStreak: Math.max(daily.bestStreak, currentStreak),
        };
        const firstResult = prev.firstResult ?? result;
        set({
          ...prev,
          submitting: false,
          status: 'feedback',
          daily: updated,
          lastResult: result,
          firstResult,
          completedToday,
          shareText: buildDailyShareText(updated.date, firstResult.isCorrect, currentStreak),
        });
      } catch (e) {
        if (myGen === gen.current) set({ ...get(), submitting: false, status: 'error', error: errorMessage(e) });
      }
    },
    [service, setProfile, get, set],
  );

  const retry = useCallback(() => {
    const cur = get();
    if (cur.status !== 'feedback') return;
    set({ ...cur, status: 'question', lastResult: undefined });
  }, [get, set]);

  return {
    status: s.status,
    daily: s.daily,
    lastResult: s.lastResult,
    completedToday: s.completedToday,
    shareText: s.shareText,
    submitting: s.submitting,
    error: s.error,
    answer,
    retry,
  };
}
