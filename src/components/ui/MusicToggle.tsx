import { useSyncExternalStore } from 'react';
import { music } from '../../lib/audio/music';

const subscribe = (cb: () => void) => music.subscribe(cb);
const getOn = () => music.isOn();

/** Speaker button that turns the background music on and off. */
export function MusicToggle({ className = '' }: { className?: string }) {
  const on = useSyncExternalStore(subscribe, getOn, getOn);
  if (!music.supported) return null;
  return (
    <button
      type="button"
      onClick={() => music.toggle()}
      aria-pressed={on}
      aria-label="Music"
      title={on ? 'Turn music off' : 'Turn music on'}
      className={
        'pixel-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-none text-white ' +
        `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball ${on ? '' : 'opacity-70'} ${className}`
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" strokeLinejoin="round" />
        {on ? (
          <path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11" strokeLinecap="round" />
        ) : (
          <path d="M16 9l5 6M21 9l-5 6" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
