import type { Profile } from '../../types';

/** Compact TIQ + XP readout for the TopBar right slot. */
export function RatingChip({ profile }: { profile: Profile | null }) {
  return (
    <span className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
      <span className="pixel-chip px-1.5 py-1 min-[380px]:px-2">
        <abbr title="Tennis IQ prototype knowledge score" className="no-underline">
          TIQ
        </abbr>{' '}
        <span className="tabular-nums text-ball">{profile ? profile.tiqRating : '—'}</span>
      </span>
      <span className="pixel-chip px-1.5 py-1 min-[380px]:px-2">
        <span className="tabular-nums">{profile ? profile.xp : '—'}</span> XP
      </span>
    </span>
  );
}
