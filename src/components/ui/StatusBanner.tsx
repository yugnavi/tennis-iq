import type { ConnectionStatus } from '../../types';

/** Shown only in practice mode, so players know answers are not ranked or saved to the server. */
export function StatusBanner({ status }: { status: ConnectionStatus }) {
  if (status.kind !== 'practice') return null;
  return (
    <p
      role="status"
      className="pixel-chip flex items-start gap-2 px-3 py-2 text-sm text-white"
    >
      <span aria-hidden="true">⚠</span>
      <span className="min-w-0">
        Practice mode — unranked{status.reason ? ` (${status.reason})` : ''}
      </span>
    </p>
  );
}
