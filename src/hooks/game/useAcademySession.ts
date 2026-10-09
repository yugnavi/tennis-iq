import { useCallback, useEffect, useRef } from 'react';
import { useReadySession } from '../../app/session';
import { pickAcademyQuestions } from '../../game/academy';
import { ACADEMY_SESSION_SIZE, type AcademySessionSize, type AcademySessionState, type AnswerResult, type PublicChallenge, type Track } from '../../types';
import { errorMessage, useSyncStore } from './shared';

const seedKey = (track: Track, count: number) => `tennis-iq:academy-seed:${track}:${count}`;

export function readAcademySeed(track: Track, count: number = ACADEMY_SESSION_SIZE): number {
  try {
    const n = Number(globalThis.localStorage?.getItem(seedKey(track, count)));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Advance the per-track session counter to at least `value` (idempotent). */
function advanceAcademySeed(track: Track, count: number, value: number): void {
  try {
    if (readAcademySeed(track, count) < value) globalThis.localStorage?.setItem(seedKey(track, count), String(value));
  } catch {
    /* storage unavailable: rotation simply restarts next time */
  }
}

/** Claim a seed for a new session immediately, so backing out and starting again still rotates questions. */
function claimAcademySeed(track: Track, count: number): number {
  const seed = readAcademySeed(track, count);
  advanceAcademySeed(track, count, seed + 1);
  return seed;
}

type Internal = {
  status: AcademySessionState['status'];
  seed: number;
  questions: PublicChallenge[];
  index: number;
  lastResult?: AnswerResult;
  results: AnswerResult[];
  submitting: boolean;
  error?: string;
};

const initial = (): Internal => ({ status: 'loading', seed: 0, questions: [], index: 0, results: [], submitting: false });

export function useAcademySession(track: Track, count: AcademySessionSize = ACADEMY_SESSION_SIZE): AcademySessionState {
  const { service, setProfile } = useReadySession();
  const [s, get, set] = useSyncStore(initial);
  const gen = useRef(0);

  const load = useCallback(() => {
    const myGen = ++gen.current;
    set(initial());
    const seed = claimAcademySeed(track, count);
    service
      .listChallenges(track)
      .then((pool) => {
        if (myGen !== gen.current) return;
        const questions = pickAcademyQuestions(
          pool.filter((c) => c.track === track),
          seed,
          count,
          { allowRepeat: true },
        );
        if (questions.length === 0) throw new Error('No questions are available for this track yet.');
        set({ ...initial(), status: 'question', seed, questions });
      })
      .catch((e: unknown) => {
        if (myGen === gen.current) set({ ...get(), status: 'error', error: errorMessage(e) });
      });
  }, [service, track, count, get, set]);

  useEffect(() => {
    load();
    return () => {
      gen.current++;
    };
  }, [load]);

  const answer = useCallback(
    async (optionId: string) => {
      const cur = get();
      const q = cur.questions[cur.index];
      if (cur.submitting || cur.status !== 'question' || !q) return;
      const myGen = gen.current;
      set({ ...cur, submitting: true });
      try {
        const result = await service.submitAnswer({ challengeId: q.id, optionId, mode: 'academy' });
        setProfile(result.profile);
        if (myGen !== gen.current) return;
        const now = get();
        set({ ...now, submitting: false, status: 'feedback', lastResult: result, results: [...now.results, result] });
      } catch (e) {
        if (myGen === gen.current) set({ ...get(), submitting: false, status: 'error', error: errorMessage(e) });
      }
    },
    [service, setProfile, get, set],
  );

  const next = useCallback(() => {
    const cur = get();
    if (cur.status !== 'feedback') return;
    if (cur.index + 1 >= cur.questions.length) {
      set({ ...cur, status: 'recap', lastResult: undefined });
    } else {
      set({ ...cur, status: 'question', index: cur.index + 1, lastResult: undefined });
    }
  }, [track, count, get, set]);

  const restart = useCallback(() => {
    load();
  }, [load]);

  const showsQuestion = s.status === 'question' || s.status === 'feedback';
  return {
    status: s.status,
    track,
    questions: s.questions,
    index: s.index,
    current: showsQuestion ? s.questions[s.index] : undefined,
    lastResult: s.lastResult,
    results: s.results,
    submitting: s.submitting,
    error: s.error,
    answer,
    next,
    restart,
  };
}
