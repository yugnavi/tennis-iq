/**
 * Wraps the ranked service with runtime failover: on an infra error the status
 * flips to practice (subscribers notified once), and that call and all later
 * calls are served by the practice service so the game never dead-ends.
 * Domain errors (invalid request) are rethrown unchanged. Reload to retry ranked.
 */
import type { AnswerSubmission, BattleState, ConnectionStatus, GameService } from '../types';
import { isDomainError } from './errors';
import type { PracticeGameService } from './practiceService';

export const FAILOVER_REASON = 'Lost connection to the server, so you are now in unranked practice. Reload to try ranked play again.';

export function createResilientService(primary: GameService, makePractice: (reason: string) => PracticeGameService): GameService {
  let status: ConnectionStatus = primary.getStatus();
  let practice: PracticeGameService | null = status.kind === 'practice' ? makePractice(status.reason ?? '') : null;
  const listeners = new Set<(s: ConnectionStatus) => void>();
  /** Last authoritative score per server battle, so a failover can continue the match locally. */
  const battles = new Map<string, BattleState>();

  function failover(error: unknown): PracticeGameService {
    if (!practice) {
      if (import.meta.env?.DEV) console.warn('[tennis-iq] switching to practice:', error);
      practice = makePractice(FAILOVER_REASON);
      status = practice.getStatus();
      for (const b of battles.values()) if (b.status === 'in_progress') practice.adoptBattle(b);
      for (const l of [...listeners]) l(status);
    }
    return practice;
  }

  async function run<T>(ranked: (s: GameService) => Promise<T>, local: (p: PracticeGameService) => Promise<T>): Promise<T> {
    if (practice) return local(practice);
    try {
      return await ranked(primary);
    } catch (e) {
      if (isDomainError(e)) throw e;
      return local(failover(e));
    }
  }

  const remember = (b: BattleState | undefined) => {
    if (b) battles.set(b.battleId, b);
  };

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getProfile: () => run((s) => s.getProfile(), (p) => p.getProfile()),
    listChallenges: (track) => run((s) => s.listChallenges(track), (p) => p.listChallenges(track)),
    getDaily: () => run((s) => s.getDaily(), (p) => p.getDaily()),
    submitAnswer: (sub: AnswerSubmission) =>
      run(
        async (s) => {
          const r = await s.submitAnswer(sub);
          remember(r.battle);
          return r;
        },
        (p) => p.submitAnswer(sub),
      ),
    startBattle: () =>
      run(
        async (s) => {
          const b = await s.startBattle();
          remember(b);
          return b;
        },
        (p) => p.startBattle(),
      ),
    abandonBattle: (id) => run((s) => s.abandonBattle(id), (p) => p.abandonBattle(id)),
    getProgress: () => run((s) => s.getProgress(), (p) => p.getProgress()),
  };
}
