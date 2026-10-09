import { NavLink } from 'react-router-dom';
import { ASSETS, type IconName } from './assets';

type Item = { to: string; label: string; icon: IconName; end?: boolean };

// Paths mirror ROUTES in src/app/App.tsx (not imported to avoid a component → app cycle).
const ITEMS: Item[] = [
  { to: '/home', label: 'Home', icon: 'home', end: true },
  { to: '/academy', label: 'Learn', icon: 'book' },
  { to: '/battle', label: 'Play', icon: 'trophy' },
  { to: '/daily', label: 'Daily', icon: 'target' },
  { to: '/progress', label: 'Progress', icon: 'medal' },
];

/**
 * Fixed bottom tab bar for the hub screens, styled as a Stardew-like wooden toolbar:
 * each tab is an inventory slot; the current page gets the red selector frame (see .sv-* in index.css).
 */
export function BottomNav() {
  return (
    <nav aria-label="Main" className="sv-toolbar fixed inset-x-0 bottom-0 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto grid max-w-md grid-cols-5 px-1 pb-3 pt-3.5">
        {ITEMS.map((it) => (
          <li key={it.to} className="flex justify-center">
            <NavLink
              to={it.to}
              end={it.end}
              className="flex min-h-14 min-w-14 flex-col items-center gap-1.5 focus-visible:outline-none [&:focus-visible_.sv-slot]:outline-3 [&:focus-visible_.sv-slot]:outline-offset-4 [&:focus-visible_.sv-slot]:outline-ball"
            >
              {({ isActive }) => (
                <>
                  <span className="sv-slot" data-active={isActive}>
                    <img
                      src={ASSETS.icon(it.icon)}
                      alt=""
                      aria-hidden="true"
                      width={28}
                      height={28}
                      className="pixelated h-7 w-7"
                    />
                  </span>
                  <span className="sv-label">{it.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
