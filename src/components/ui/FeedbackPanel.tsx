import { useEffect, useRef, type ReactNode } from 'react';
import type { AnswerResult } from '../../types';
import { ASSETS, signed } from './assets';
import { Button } from './Button';

type FeedbackPanelProps = {
  result?: AnswerResult;
  onNext?: () => void;
  nextLabel?: string;
  /** Extra line(s) under the headline, e.g. "Point to you — 3–2". */
  extra?: ReactNode;
  /** Optional source attribution for the question. */
  source?: { name: string; url: string };
  /** Replace the Next button entirely (e.g. Daily: Retry/Home/Share). */
  actions?: ReactNode;
  /** Move keyboard focus to the Next button when feedback appears (default true). */
  autoFocusNext?: boolean;
};

/**
 * Feedback area. The aria-live region is always mounted (so screen readers announce the
 * result) and reserves a little height so the page doesn't jump much when feedback appears.
 */
export function FeedbackPanel({
  result,
  onNext,
  nextLabel = 'Next',
  extra,
  source,
  actions,
  autoFocusNext = true,
}: FeedbackPanelProps) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const key = result ? `${result.challengeId}:${result.chosenOptionId}` : '';

  useEffect(() => {
    if (!key) return;
    if (autoFocusNext && nextRef.current) {
      nextRef.current.focus();
    } else {
      panelRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [key, autoFocusNext]);

  return (
    <div aria-live="polite" ref={panelRef} className="min-h-4">
      {result && (
        <section
          aria-label="Answer feedback"
          className={`pixel-card bg-card p-4 text-ink ${result.isCorrect ? 'shadow-[inset_0_4px_0_0_#fff8e8,inset_0_-4px_0_0_#d5b77a,0_-4px_0_0_var(--color-correct),0_4px_0_0_var(--color-correct),-4px_0_0_0_var(--color-correct),4px_0_0_0_var(--color-correct),0_12px_0_0_rgb(10_21_30_/_0.55)]' : 'shadow-[inset_0_4px_0_0_#fff8e8,inset_0_-4px_0_0_#d5b77a,0_-4px_0_0_var(--color-wrong),0_4px_0_0_var(--color-wrong),-4px_0_0_0_var(--color-wrong),4px_0_0_0_var(--color-wrong),0_12px_0_0_rgb(10_21_30_/_0.55)]'}`}
        >
          <div className="flex gap-3">
            <img
              src={ASSETS.coach}
              alt=""
              aria-hidden="true"
              width={56}
              height={56}
              className="pixelated h-14 w-14 shrink-0 -ml-1"
            />
            <div className="min-w-0 flex-1">
              <h2 className={`text-lg font-bold ${result.isCorrect ? 'text-correct' : 'text-wrong'}`}>
                <span aria-hidden="true">{result.isCorrect ? '✓ ' : '✗ '}</span>
                {result.isCorrect ? 'Correct!' : 'Not quite'}
              </h2>
              {extra && <div className="mt-1 font-semibold">{extra}</div>}
              <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
              {source && (
                <p className="mt-2 text-xs text-ink/70">
                  Source:{' '}
                  <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline">
                    {source.name}
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {result.awards.map((a) => (
              <span
                key={a.kind + a.label}
                className="bg-cta-500/15 px-3 py-1 text-xs font-bold text-cta-700"
              >
                {a.label} · {signed(a.xp)} XP
              </span>
            ))}
            {result.ranked && result.ratingDelta !== 0 && (
              <span className="bg-navy-700/10 px-3 py-1 text-xs font-bold text-navy-800">
                TIQ {signed(result.ratingDelta)}
              </span>
            )}
          </div>

          {!result.ranked && (
            <p className="mt-2 text-xs font-semibold text-ink/70">
              Unranked practice — this answer doesn’t change your TIQ.
            </p>
          )}

          {actions ?? (
            onNext && (
              <Button ref={nextRef} onClick={onNext} block className="mt-4">
                {nextLabel}
              </Button>
            )
          )}
        </section>
      )}
    </div>
  );
}
