import { useEffect, useState } from 'react';
import type { AnswerResult, ChallengeOption } from '../../types';

export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';

type AnswerOptionProps = {
  letter: string;
  label: string;
  state?: AnswerState;
  disabled?: boolean;
  onSelect?: () => void;
};

const STATE_CLASS: Record<AnswerState, string> = {
  idle: 'bg-white hover:bg-card',
  selected: 'bg-[#dcf2e2]',
  correct: 'bg-[#dcf2e2]',
  wrong: 'bg-[#f8e1dc]',
  disabled: 'bg-white opacity-70',
};

const CHIP_CLASS: Record<AnswerState, string> = {
  idle: 'bg-[#e9ece4] text-ink',
  selected: 'bg-cta-600 text-white',
  correct: 'bg-correct text-white',
  wrong: 'bg-wrong text-white',
  disabled: 'bg-[#e9ece4] text-ink',
};

/** One of the four answer buttons: letter chip + label; correct/wrong also shown by icon and text. */
export function AnswerOption({ letter, label, state = 'idle', disabled, onSelect }: AnswerOptionProps) {
  const locked = disabled || state === 'disabled' || state === 'correct' || state === 'wrong';
  return (
    <button
      type="button"
      onClick={locked ? undefined : onSelect}
      disabled={locked}
      aria-pressed={state === 'selected'}
      data-state={state}
      className={
        'pixel-card flex min-h-12 w-full min-w-0 items-center gap-3 border-0 px-2.5 py-1.5 text-left text-[15px] leading-snug text-ink transition-colors ' +
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball disabled:cursor-default ' +
        STATE_CLASS[state]
      }
    >
      <span
        aria-hidden="true"
        className={`font-pixel flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold ${CHIP_CLASS[state]}`}
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1 break-words font-medium">
        <span className="sr-only">Option {letter}:</span> {label}
      </span>
      {state === 'correct' && (
        <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-correct">
          <span aria-hidden="true">✓</span>
          <span>Correct</span>
        </span>
      )}
      {state === 'wrong' && (
        <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-wrong">
          <span aria-hidden="true">✗</span>
          <span>Your pick</span>
        </span>
      )}
    </button>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Derives each option's state from the answer result / in-flight submission. */
export function answerStateFor(
  optionId: string,
  opts: { result?: AnswerResult; pendingId?: string; submitting?: boolean },
): AnswerState {
  const { result, pendingId, submitting } = opts;
  if (result) {
    if (optionId === result.correctOptionId) return 'correct';
    if (optionId === result.chosenOptionId) return 'wrong';
    return 'disabled';
  }
  if (submitting) return optionId === pendingId ? 'selected' : 'disabled';
  return 'idle';
}

type AnswerListProps = {
  /** Changes per question; resets local selection. */
  questionKey: string;
  options: ChallengeOption[];
  result?: AnswerResult;
  submitting: boolean;
  onAnswer(optionId: string): void;
};

/** The four answers for a question as a labelled group. */
export function AnswerList({ questionKey, options, result, submitting, onAnswer }: AnswerListProps) {
  const [pendingId, setPendingId] = useState<string>();
  useEffect(() => setPendingId(undefined), [questionKey]);

  return (
    <ul className="flex flex-col gap-2" aria-label="Answers">
      {options.map((o, i) => (
        <li key={o.id}>
          <AnswerOption
            letter={LETTERS[i] ?? String(i + 1)}
            label={o.label}
            state={answerStateFor(o.id, { result, pendingId, submitting })}
            onSelect={() => {
              if (submitting || result) return;
              setPendingId(o.id);
              onAnswer(o.id);
            }}
          />
        </li>
      ))}
    </ul>
  );
}
