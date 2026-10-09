import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MusicToggle } from './MusicToggle';

type TopBarProps = {
  title: string;
  /** Route to go back to (renders a link). */
  backTo?: string;
  /** Custom back action (renders a button), e.g. to abandon a battle first. Takes precedence over backTo. */
  onBack?: () => void;
  backLabel?: string;
  /** Right slot: rating, score, etc. */
  right?: ReactNode;
};

const BACK_CLASS =
  'pixel-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-none text-white ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball';

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ title, backTo, onBack, backLabel = 'Back', right }: TopBarProps) {
  const back = onBack ? (
    <button type="button" onClick={onBack} className={BACK_CLASS} aria-label={backLabel}>
      <Chevron />
    </button>
  ) : backTo ? (
    <Link to={backTo} className={BACK_CLASS} aria-label={backLabel}>
      <Chevron />
    </Link>
  ) : (
    <span className="w-2 shrink-0" aria-hidden="true" />
  );

  return (
    <header
      className="sticky top-0 z-20 bg-navy-950 text-white shadow-[0_4px_0_0_var(--color-navy-800)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="mx-auto flex min-h-14 max-w-md items-center gap-2 py-1"
        style={{ paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
      >
        {back}
        <h1 className="pixel-heading min-w-0 flex-1 truncate text-base font-bold min-[380px]:text-lg">{title}</h1>
        {right != null && <div className="flex shrink-0 items-center gap-2 text-sm">{right}</div>}
        <MusicToggle className="-mr-2" />
      </div>
    </header>
  );
}
