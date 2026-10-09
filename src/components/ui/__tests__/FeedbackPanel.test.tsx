import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerResult } from '../../../types';
import { FeedbackPanel } from '../FeedbackPanel';
import { StatusBanner } from '../StatusBanner';

const base: AnswerResult = {
  challengeId: 'strategist-03',
  chosenOptionId: 'b',
  isCorrect: true,
  correctOptionId: 'b',
  explanation: 'The drop shot works because the opponent is far behind the baseline.',
  ranked: true,
  ratingDelta: 15,
  awards: [{ kind: 'first_correct', xp: 20, label: 'First correct' }],
  profile: { userId: 'u', displayName: 'P', xp: 20, tiqRating: 515 },
};

describe('FeedbackPanel', () => {
  it('shows correct headline, explanation, awards and rating; Next works', () => {
    const onNext = vi.fn();
    render(<FeedbackPanel result={base} onNext={onNext} />);
    expect(screen.getByRole('heading', { name: /correct!/i })).toBeInTheDocument();
    expect(screen.getByText(base.explanation)).toBeInTheDocument();
    expect(screen.getByText(/first correct · \+20 XP/i)).toBeInTheDocument();
    expect(screen.getByText('TIQ +15')).toBeInTheDocument();
    expect(screen.queryByText(/unranked practice/i)).toBeNull();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toHaveFocus();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows "Not quite" and the unranked note when result.ranked is false', () => {
    render(<FeedbackPanel result={{ ...base, isCorrect: false, chosenOptionId: 'a', ranked: false, ratingDelta: 0, awards: [] }} />);
    expect(screen.getByRole('heading', { name: /not quite/i })).toBeInTheDocument();
    expect(screen.getByText(/unranked practice/i)).toBeInTheDocument();
    expect(screen.queryByText(/^TIQ [+−]/)).toBeNull();
  });

  it('keeps an aria-live region mounted before any result', () => {
    const { container } = render(<FeedbackPanel />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe('StatusBanner', () => {
  it('shows practice reason and hides when ranked', () => {
    const { rerender } = render(<StatusBanner status={{ kind: 'practice', reason: 'Offline' }} />);
    expect(screen.getByText('Practice mode — unranked (Offline)')).toBeInTheDocument();
    rerender(<StatusBanner status={{ kind: 'ranked' }} />);
    expect(screen.queryByText(/practice mode/i)).toBeNull();
  });
});
