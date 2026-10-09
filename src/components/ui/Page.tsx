import type { CSSProperties, ReactNode } from 'react';
import { ASSETS } from './assets';
import { BottomNav } from './BottomNav';

export type PageCourt = keyof typeof ASSETS.courtBackdrops;

/**
 * Page shell: full-height navy background, centred max-w-md column, safe-area padding.
 * Put a <TopBar> in `header`; content scrolls naturally (no viewport-height lock).
 */
export function Page({
  header,
  children,
  className = '',
  nav = false,
  court,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Show the fixed bottom tab bar (hub screens only, not during a question flow). */
  nav?: boolean;
  /** Optional full-page court art replacing the default training-grid background. */
  court?: PageCourt;
}) {
  const style = court
    ? ({
        '--page-court-bg': `url(${ASSETS.courtBackdrops[court]})`,
      } as CSSProperties)
    : undefined;

  return (
    <div className={`pixel-page min-h-dvh text-white ${court ? 'pixel-page-court' : ''}`} style={style}>
      {header}
      <main
        className={`mx-auto flex w-full min-w-0 max-w-md flex-col gap-4 pt-4 [overflow-wrap:anywhere] ${className}`}
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingBottom: `calc(${nav ? '7rem' : '1.5rem'} + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  );
}
