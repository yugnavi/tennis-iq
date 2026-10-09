/** Tie-break scoring engine (pure). First to TIEBREAK.target, win by TIEBREAK.margin. */
import { TIEBREAK } from '../types';

export type Side = 'player' | 'opponent';

export function tiebreakWinner(player: number, opponent: number): Side | null {
  if (player >= TIEBREAK.target && player - opponent >= TIEBREAK.margin) return 'player';
  if (opponent >= TIEBREAK.target && opponent - player >= TIEBREAK.margin) return 'opponent';
  return null;
}

/**
 * Server for a 1-based point number. The player serves point 1; after that the
 * serve alternates every two points (2–3 opponent, 4–5 player, ...).
 */
export function tiebreakServer(pointNumber: number): Side {
  const n = Math.max(1, Math.floor(pointNumber));
  return Math.floor(n / 2) % 2 === 1 ? 'opponent' : 'player';
}

export type TiebreakScore = {
  player: number;
  opponent: number;
  winner: Side | null;
};

export const INITIAL_TIEBREAK: TiebreakScore = { player: 0, opponent: 0, winner: null };

/** Reducer: award one point. Once the tie-break is decided, the state is returned unchanged. */
export function applyPoint(state: TiebreakScore, winner: Side): TiebreakScore {
  if (state.winner || tiebreakWinner(state.player, state.opponent)) return state;
  const player = state.player + (winner === 'player' ? 1 : 0);
  const opponent = state.opponent + (winner === 'opponent' ? 1 : 0);
  return { player, opponent, winner: tiebreakWinner(player, opponent) };
}

/** 1-based number of the point about to be played. */
export function nextPointNumber(score: { player: number; opponent: number }): number {
  return score.player + score.opponent + 1;
}
