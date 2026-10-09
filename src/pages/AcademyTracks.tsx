import { Link } from 'react-router-dom';
import { ROUTES } from '../app/App';
import { Badge, Page, TopBar } from '../components/ui';
import { ACADEMY_SESSION_SIZES, TRACK_LABELS, TRACKS } from '../types';

export default function AcademyTracksPage() {
  return (
    <Page nav court="clay" header={<TopBar title="Academy" backTo={ROUTES.home} />}>
      <p className="pixel-chip px-3 py-2 text-sm text-white/85">Pick a track, then choose session length.</p>
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
              <div className="grid grid-cols-3 gap-2" aria-label={`${TRACK_LABELS[t].title} session length`}>
                {ACADEMY_SESSION_SIZES.map((count) => (
                  <Link
                    key={count}
                    to={ROUTES.academyTrack(t, count)}
                    className="btn-pixel-secondary flex min-h-10 items-center justify-center px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball"
                  >
                    {count} Q
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
