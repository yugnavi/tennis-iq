import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../app/App';
import { ASSETS, ButtonLink, MusicToggle, type IconName } from '../components/ui';

/**
 * Full-screen pixel-art court scene (864×1536, open sky at the top for the logo).
 * Animated WebP loop; the first frame is served instead under prefers-reduced-motion (see .landing-hero).
 */
const LANDING = `${import.meta.env.BASE_URL ?? '/'}assets/landing/`;
const HERO_VARS = {
  '--hero-animated': `url(${LANDING}landing_hero_animated.webp)`,
  '--hero-still': `url(${LANDING}landing_hero_still.webp)`,
} as CSSProperties;

const FEATURES: { icon: IconName; text: string }[] = [
  { icon: 'book', text: 'Learn tactics' },
  { icon: 'trophy', text: 'Win tie\u2011breaks' }, // non-breaking hyphen keeps "tie‑breaks" together
  { icon: 'star', text: 'Grow your\u00a0IQ' }, // keeps "your IQ" on one line
];

/** Tap 1: Start Playing → Home. Tap 2: a mode. No signup. */
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-navy-900 text-white">
      <main
        className="landing-hero pixelated relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-cover bg-[position:30%_bottom] [overflow-wrap:anywhere]"
        style={HERO_VARS}
      >
        {/* Sky: logo, tagline and feature chips. */}
        <header
          className="relative text-center"
          style={{
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
            paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
          }}
        >
          <MusicToggle className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))]" />
          {/* Text logo (the v3 wordmark PNG is off-centre with a wide gap, so it can't be centred). */}
          <h1 className="pixel-logo text-[clamp(2.75rem,15vw,4rem)] leading-none">
            <span className="text-card">TENNIS</span> <span className="text-cta-500">IQ</span>
          </h1>
          <p className="mt-3 font-['Pixelify_Sans'] text-base font-bold uppercase tracking-[0.25em] text-white [text-shadow:0_2px_0_rgb(16_31_43/0.85)]">
            Play smarter tennis
          </p>
          <ul className="mx-auto mt-5 grid w-full max-w-sm grid-cols-3 gap-2.5">
            {FEATURES.map((f) => (
              <li
                key={f.text}
                className="pixel-panel flex min-w-0 flex-col items-center justify-center gap-1 bg-navy-800/90 px-1.5 py-2 text-center font-['Pixelify_Sans'] text-[13px] font-semibold leading-tight"
              >
                <img src={ASSETS.icon(f.icon)} alt="" aria-hidden="true" width={24} height={24} className="pixelated h-6 w-6" />
                {f.text}
              </li>
            ))}
          </ul>
        </header>

        {/* Compact bottom panel over a fade, so the player art stays visible above it. */}
        <div
          className="relative mt-auto flex flex-col items-center gap-3 bg-gradient-to-b from-transparent via-navy-950/75 to-navy-950 pt-10"
          style={{
            paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
            paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
          }}
        >
          <ButtonLink to={ROUTES.home} variant="pixel" size="lg" block className="max-w-[19rem]">
            Start Playing
          </ButtonLink>
          <p className="text-xs text-white/70">No signup · Free · 2-minute rounds</p>
          <Link
            to={ROUTES.daily}
            className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-ball underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball"
          >
            Play today’s Daily Puzzle
          </Link>
        </div>
      </main>
    </div>
  );
}
