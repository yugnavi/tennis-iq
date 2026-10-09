/**
 * Game hooks (Agent 3). Signatures are fixed by the hook contracts in src/types.
 * Correctness, XP and rating always come from `service.submitAnswer`.
 */
export { useAcademySession } from './useAcademySession';
export { useTiebreakBattle, MAX_BATTLE_POINTS } from './useTiebreakBattle';
export { useDailyPuzzle } from './useDailyPuzzle';
