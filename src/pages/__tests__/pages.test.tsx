import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../../app/session';
import type {
  AcademySessionState,
  AnswerResult,
  DailyPuzzleState,
  GameService,
  Profile,
  PublicChallenge,
  TiebreakBattleState,
} from '../../types';

// ---- Local test fixtures only (never shipped in pages) ----
const profile: Profile = { userId: 'u1', displayName: 'Player', xp: 40, tiqRating: 530 };

const challenge: PublicChallenge = {
  id: 'strategist-01',
  track: 'strategist',
  kind: 'shot-choice',
  difficulty: 2,
  prompt: 'Your opponent is deep behind the baseline. You receive a short ball. Best option?',
  options: [
    { id: 'a', label: 'Deep crosscourt' },
    { id: 'b', label: 'Drop shot' },
    { id: 'c', label: 'Lob' },
    { id: 'd', label: 'Down the line' },
  ],
  sourceName: 'Coaching notes',
  sourceUrl: 'https://example.org/notes',
  court: {
    player: { x: 45, y: 70 },
    opponent: { x: 50, y: 3 },
    ball: { x: 48, y: 62 },
    recommendedPath: [
      { x: 48, y: 62 },
      { x: 60, y: 40 },
    ],
    caption: 'Opponent is far behind the top baseline; the ball sits short in front of you.',
  },
};

const result: AnswerResult = {
  challengeId: challenge.id,
  chosenOptionId: 'b',
  isCorrect: true,
  correctOptionId: 'b',
  explanation: 'A drop shot exploits the opponent being far behind the baseline.',
  ranked: false,
  ratingDelta: 0,
  awards: [],
  profile,
};

const service: GameService = {
  getStatus: () => ({ kind: 'practice', reason: 'Supabase not configured' }),
  subscribe: () => () => {},
  getProfile: async () => profile,
  listChallenges: async () => [challenge],
  getDaily: async () => ({ date: '2026-10-09', challenge, alreadyCompleted: false, currentStreak: 3, bestStreak: 5 }),
  submitAnswer: async () => result,
  startBattle: async () => ({ battleId: 'b1', playerPoints: 0, opponentPoints: 0, status: 'in_progress' }),
  abandonBattle: async () => {},
  submitFeedback: async () => {},
  getProgress: async () => ({
    profile,
    totalAttempts: 10,
    totalCorrect: 7,
    byTrack: {
      rookie: { attempted: 5, correct: 4, mastered: 4, total: 10 },
      challenger: { attempted: 5, correct: 3, mastered: 3, total: 10 },
      strategist: { attempted: 0, correct: 0, mastered: 0, total: 10 },
    },
    battlesPlayed: 2,
    battlesWon: 1,
    dailyCompletions: 3,
    currentStreak: 3,
    bestStreak: 5,
  }),
};

const noop = async () => {};
const hookState = {
  academy: undefined as AcademySessionState | undefined,
  battle: undefined as TiebreakBattleState | undefined,
  daily: undefined as DailyPuzzleState | undefined,
};

vi.mock('../../hooks/game', () => ({
  useAcademySession: () => hookState.academy,
  useTiebreakBattle: () => hookState.battle,
  useDailyPuzzle: () => hookState.daily,
}));

import AcademySession from '../AcademySession';
import Battle from '../Battle';
import Daily from '../Daily';
import Home from '../Home';
import Landing from '../Landing';
import Progress from '../Progress';

function renderAt(path: string, pattern: string, element: React.ReactNode) {
  return render(
    <SessionProvider service={service}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

beforeEach(() => {
  hookState.academy = {
    status: 'feedback',
    track: 'strategist',
    questions: [challenge],
    index: 0,
    current: challenge,
    lastResult: result,
    results: [result],
    submitting: false,
    answer: noop,
    next: () => {},
    restart: () => {},
  };
  hookState.battle = {
    status: 'question',
    score: { player: 6, opponent: 5 },
    server: 'opponent',
    pointNumber: 12,
    current: challenge,
    submitting: false,
    answer: noop,
    next: () => {},
    exit: noop,
    restart: () => {},
  };
  hookState.daily = {
    status: 'feedback',
    daily: { date: '2026-10-09', challenge, alreadyCompleted: true, currentStreak: 3, bestStreak: 5 },
    lastResult: { ...result, dailyRecorded: false },
    completedToday: true,
    shareText: 'Tennis IQ Daily 2026-10-09 ✓',
    submitting: false,
    answer: noop,
    retry: () => {},
  };
});

describe('pages', () => {
  it('Landing has one Start Playing link to /home', () => {
    renderAt('/', '/', <Landing />);
    expect(screen.getByRole('link', { name: 'Start Playing' })).toHaveAttribute('href', '/home');
  });

  it('Home shows practice banner, daily card date and modes', async () => {
    renderAt('/home', '/home', <Home />);
    expect(await screen.findByText(/9 Oct 2026 \(UTC\)/)).toBeInTheDocument();
    expect(screen.getByText('Practice mode — unranked (Supabase not configured)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tie-break battle/i })).toHaveAttribute('href', '/battle');
    expect(screen.getByText(/prototype knowledge score/i)).toBeInTheDocument();
  });

  it('Academy session renders court, counter and unranked feedback', async () => {
    renderAt('/academy/strategist', '/academy/:track', <AcademySession />);
    expect(await screen.findByText('Q 1/1')).toBeInTheDocument();
    expect(screen.getByText(challenge.court!.caption)).toBeInTheDocument();
    expect(screen.getByTestId('court-path')).toBeInTheDocument();
    expect(screen.getByText(/unranked practice/i)).toBeInTheDocument();
  });

  it('Academy session rejects an invalid track', () => {
    renderAt('/academy/pro', '/academy/:track', <AcademySession />);
    expect(screen.getByText(/don’t have that track/i)).toBeInTheDocument();
  });

  it('Academy recap shows score and buttons', async () => {
    hookState.academy = { ...hookState.academy!, status: 'recap', current: undefined };
    renderAt('/academy/strategist', '/academy/:track', <AcademySession />);
    expect(await screen.findByText('1/1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });

  it('Battle shows scoreboard, disclaimer and hides path before answering', async () => {
    renderAt('/battle', '/battle', <Battle />);
    expect(await screen.findByText(/not a simulation of real tennis ability/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Tie-break score: You 6, Opponent 5')).toBeInTheDocument();
    expect(screen.queryByTestId('court-path')).toBeNull();
    expect(screen.getAllByRole('button', { name: /option/i })).toHaveLength(4);
  });

  it('Battle finished screen', async () => {
    hookState.battle = {
      ...hookState.battle!,
      status: 'finished',
      summary: {
        won: true,
        playerPoints: 7,
        opponentPoints: 5,
        correctAnswers: 7,
        totalAnswers: 12,
        xpEarned: 50,
        ratingDelta: 30,
        awards: [{ kind: 'battle_complete', xp: 10, label: 'Battle complete' }],
      },
    };
    renderAt('/battle', '/battle', <Battle />);
    expect(await screen.findByRole('heading', { name: 'Game, Set, Match!' })).toBeInTheDocument();
    expect(screen.getByText('7/12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeInTheDocument();
  });

  it('Daily shows UTC date, streak, practice-retry note and share fallback', async () => {
    renderAt('/daily', '/daily', <Daily />);
    expect(await screen.findByRole('heading', { name: /Daily Puzzle · 9 Oct 2026/ })).toBeInTheDocument();
    expect(screen.getByText(/3-day streak/)).toBeInTheDocument();
    expect(screen.getByText(/Already completed today — this retry is for practice/)).toBeInTheDocument();
    // jsdom has no navigator.share → readonly textarea fallback
    expect(screen.getByRole('textbox')).toHaveValue('Tennis IQ Daily 2026-10-09 ✓');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Progress shows totals and three skill bars', async () => {
    renderAt('/progress', '/progress', <Progress />);
    expect(await screen.findByText('70%')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    expect(screen.getByText('4/10 mastered')).toBeInTheDocument();
  });
});
