/**
 * Public asset helpers. v3 pixel pack (public/assets/tennis-iq-v3) is the primary art set;
 * the v2 pack (public/assets/tennis-iq) remains for anything v3 lacks.
 */
const ROOT = `${import.meta.env.BASE_URL ?? '/'}assets/`;

export const asset = (path: string) => `${ROOT}tennis-iq/${path}`;
export const assetV3 = (path: string) => `${ROOT}tennis-iq-v3/${path}`;

export type IconName =
  | 'book' | 'calendar' | 'check' | 'cross' | 'flame' | 'home' | 'lightning' | 'lock'
  | 'medal' | 'settings' | 'shield' | 'star' | 'target' | 'trophy';

export const ASSETS = {
  /** Feedback avatar (v3 has no NPC set; a v3 player skin keeps the art consistent). */
  coach: assetV3('characters/player_05/idle_right.png'),
  /** 192×256 transparent sprites; feet at y≈247. */
  playerIdle: assetV3('characters/player_01/idle_right.png'),
  opponent: assetV3('characters/player_02/idle_left.png'),
  player: (skin: 1 | 2 | 3 | 4 | 5 | 6, pose: string, facing: 'left' | 'right' = 'right') =>
    assetV3(`characters/player_0${skin}/${pose}_${facing}.png`),
  ball: assetV3('equipment/ball.png'),
  icon: (name: IconName) => assetV3(`icons/${name}.png`),
  wordmark: assetV3('branding/tennis_iq_wordmark.png'),
  appIcon: assetV3('branding/app_icon_symbol.png'),
  badges: {
    ballKid: assetV3('badges/rank_01_ball_kid.png'),
    rookie: assetV3('badges/rank_02_rookie.png'),
    clubPlayer: assetV3('badges/rank_03_club_player.png'),
    challenger: assetV3('badges/rank_04_challenger.png'),
    tourPlayer: assetV3('badges/rank_05_tour_player.png'),
    strategist: assetV3('badges/rank_06_strategist.png'),
    grandSlam: assetV3('badges/rank_07_grand_slam.png'),
  },
  arenas: {
    localClub: assetV3('arenas/arena_local_club_portrait.png'),
    national: assetV3('arenas/arena_regional_tournament_portrait.png'),
    grandSlam: assetV3('arenas/arena_grand_slam_night_portrait.png'),
  },
  /** Tactical court: exact COURT_LANDMARKS geometry (360×580). Hard uses the v3-coloured copy. */
  court: (surface: 'hard' | 'clay' | 'grass' | 'indoor' = 'hard') =>
    surface === 'hard' ? assetV3('courts/tactical_hard.svg') : asset(`courts/gameplay/${surface}.svg`),
  /** Decorative v3 stadium frame (720×1200) the tactical court is laid over. */
  courtFrame: assetV3('courts/court_hard_portrait.png'),
  courtBackdrops: {
    hard: assetV3('courts/court_hard_portrait.png'),
    clay: assetV3('courts/court_clay_portrait.png'),
    grass: assetV3('courts/court_grass_portrait.png'),
    indoor: assetV3('courts/court_indoor_portrait.png'),
  },
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-09" -> "9 Oct 2026". Pure string formatting, so no timezone drift. */
export function formatUtcDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const [, y, mo, d] = m;
  return `${Number(d)} ${MONTHS[Number(mo) - 1] ?? mo} ${y}`;
}

/** Signed number, e.g. +15 / −5 / 0. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}
