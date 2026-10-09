import type { AnswerResult, PublicChallenge } from '../../types';
import { AnswerList } from './AnswerOption';

type QuestionCardProps = {
  challenge: PublicChallenge;
  result?: AnswerResult;
  submitting: boolean;
  onAnswer(optionId: string): void;
  /** Small label above the prompt, e.g. "Question 2 of 5". */
  eyebrow?: string;
  /** Court scene description shown above the prompt (pairs with the court 'stage' layout). */
  scenario?: string;
};

/** Prompt + four answers. */
export function QuestionCard({ challenge, result, submitting, onAnswer, eyebrow, scenario = challenge.court?.caption }: QuestionCardProps) {
  const headingId = `prompt-${challenge.id}`;
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="pixel-card bg-card px-4 py-3 text-ink">
        {eyebrow && <p className="font-pixel mb-1 text-xs font-semibold uppercase tracking-wide text-ink/60">{eyebrow}</p>}
        {scenario && (
          <p className="mb-2 text-sm leading-snug text-ink/75">
            <span className="sr-only">Court situation: </span>
            {scenario}
          </p>
        )}
        <h2 id={headingId} className="text-base font-bold leading-snug sm:text-lg">
          {challenge.prompt}
        </h2>
      </div>
      <AnswerList
        questionKey={challenge.id}
        options={challenge.options}
        result={result}
        submitting={submitting}
        onAnswer={onAnswer}
      />
    </section>
  );
}
