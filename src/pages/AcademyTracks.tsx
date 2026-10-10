import { Link } from 'react-router-dom';
import { ROUTES } from '../app/App';
import { Badge, Page, TopBar } from '../components/ui';
import { ACADEMY_MAP_STOPS, readAcademyMapStop } from '../game/academy';
import { ACADEMY_SESSION_SIZES, TRACK_LABELS, TRACKS, type Track } from '../types';

function bestMapStop(track: Track) {
  return Math.max(...ACADEMY_SESSION_SIZES.map((count) => readAcademyMapStop(track, count)));
}

function AcademyMapPreview({ track }: { track: Track }) {
  const activeStop = bestMapStop(track);
  return (
    <div className="bg-navy-900 px-3 py-3 text-card shadow-[inset_0_-4px_0_#0a151e,inset_0_4px_0_rgba(255,255,255,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase text-card/75">
        <span>Academy map</span>
        <span>
          Stop {activeStop}/{ACADEMY_MAP_STOPS.length}
        </span>
      </div>
      <ol aria-label={`${TRACK_LABELS[track].title} academy map`} className="grid grid-cols-6 gap-1">
        {ACADEMY_MAP_STOPS.map((stop, index) => {
          const number = index + 1;
          const unlocked = number <= activeStop;
          const current = number === activeStop;
          return (
            <li key={stop} className="min-w-0">
              <span
                title={stop}
                className={`font-pixel flex aspect-square items-center justify-center border-2 text-[10px] font-bold ${
                  current
                    ? 'border-ball bg-cta-500 text-white shadow-[0_4px_0_#0a151e]'
                    : unlocked
                      ? 'border-card bg-ball text-navy-950'
                      : 'border-navy-700 bg-navy-800 text-white/35'
                }`}
              >
                {number}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function AcademyTracksPage() {
  return (
    <Page nav court="clay" header={<TopBar title="Academy" backTo={ROUTES.home} />}>
      <p className="pixel-chip px-3 py-2 text-sm text-white/85">Perfect scores move you to the next map stop.</p>
      <ul className="flex flex-col gap-3">
        {TRACKS.map((t) => (
          <li key={t}>
            <div className="pixel-card flex min-w-0 flex-col gap-3 bg-card p-3 text-ink">
              <div className="flex min-w-0 items-center gap-3">
                <Badge name={t} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="font-pixel block text-lg font-bold">{TRACK_LABELS[t].title}</span>
                  <span className="block text-sm text-ink/75">{TRACK_LABELS[t].blurb}</span>
                </span>
              </div>
              <AcademyMapPreview track={t} />
              <div className="grid grid-cols-3 gap-2" aria-label={`${TRACK_LABELS[t].title} session length`}>
                {ACADEMY_SESSION_SIZES.map((count) => (
                  <Link
                    key={count}
                    to={ROUTES.academyTrack(t, count)}
                    className="btn-pixel-secondary flex min-h-12 flex-col items-center justify-center px-2 py-1 text-sm leading-tight focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball"
                  >
                    <span>{count} Q</span>
                    <span className="font-sans text-[11px] font-bold tracking-normal text-ink/70">Stop {readAcademyMapStop(t, count)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}
