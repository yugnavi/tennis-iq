import type { BadgeName } from './Badge';

/**
 * Display-only rank tiers for the TIQ prototype score.
 * Purely cosmetic labels for the dashboard; not an official or server-side rating.
 */
export const RANKS: { min: number; title: string; badge: BadgeName }[] = [
  { min: 0, title: 'Ball Kid', badge: 'ballKid' },
  { min: 500, title: 'Rookie', badge: 'rookie' },
  { min: 560, title: 'Club Player', badge: 'clubPlayer' },
  { min: 640, title: 'Challenger', badge: 'challenger' },
  { min: 720, title: 'Tour Player', badge: 'tourPlayer' },
  { min: 800, title: 'Strategist', badge: 'strategist' },
  { min: 890, title: 'Grand Slam', badge: 'grandSlam' },
];

export function rankFor(rating: number) {
  let i = 0;
  while (i + 1 < RANKS.length && rating >= RANKS[i + 1]!.min) i++;
  const current = RANKS[i]!;
  const next = RANKS[i + 1];
  const progress = next ? Math.round(((rating - current.min) / (next.min - current.min)) * 100) : 100;
  return { current, next, progress: Math.max(0, Math.min(100, progress)) };
}
