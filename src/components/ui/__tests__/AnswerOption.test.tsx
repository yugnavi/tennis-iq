import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerResult } from '../../../types';
import { AnswerList, AnswerOption, answerStateFor } from '../AnswerOption';

const result: AnswerResult = {
  challengeId: 'rookie-01',
  chosenOptionId: 'b',
  isCorrect: false,
  correctOptionId: 'c',
  explanation: 'Explanation text long enough.',
  ranked: true,
  ratingDelta: -5,
  awards: [],
  profile: { userId: 'u', displayName: 'P', xp: 0, tiqRating: 495 },
};

describe('AnswerOption', () => {
  it('idle: clickable and not pressed', () => {
    const onSelect = vi.fn();
    render(<AnswerOption letter="A" label="Deuce" onSelect={onSelect} />);
    const btn = screen.getByRole('button', { name: /option a: deuce/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('selected: aria-pressed true', () => {
    render(<AnswerOption letter="B" label="Advantage" state="selected" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('correct and wrong show text, not just colour, and are locked', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<AnswerOption letter="C" label="Love" state="correct" onSelect={onSelect} />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    rerender(<AnswerOption letter="C" label="Love" state="wrong" onSelect={onSelect} />);
    expect(screen.getByText('Your pick')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disabled state disables the button', () => {
    render(<AnswerOption letter="D" label="Let" state="disabled" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('answerStateFor derives states from a result', () => {
    expect(answerStateFor('c', { result })).toBe('correct');
    expect(answerStateFor('b', { result })).toBe('wrong');
    expect(answerStateFor('a', { result })).toBe('disabled');
    expect(answerStateFor('a', { submitting: true, pendingId: 'a' })).toBe('selected');
    expect(answerStateFor('b', { submitting: true, pendingId: 'a' })).toBe('disabled');
    expect(answerStateFor('a', {})).toBe('idle');
  });

  it('AnswerList renders four lettered options and reports the choice', () => {
    const onAnswer = vi.fn();
    const options = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: `Label ${id}` }));
    render(<AnswerList questionKey="q1" options={options} submitting={false} onAnswer={onAnswer} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /option c/i }));
    expect(onAnswer).toHaveBeenCalledWith('c');
  });
});
