import { Button } from './Button';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-12 text-white">
      <span
        aria-hidden="true"
        className="h-10 w-10 rounded-full border-4 border-white/20 border-t-ball motion-safe:animate-spin"
      />
      <span className="text-sm text-white/80">{label}</span>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  /** Defaults to reloading the page. */
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  return (
    <div role="alert" className="pixel-card-green flex flex-col items-center gap-3 px-4 py-8 text-center text-white">
      <p className="font-pixel text-lg font-bold">{title}</p>
      {message && <p className="text-sm text-white/80">{message}</p>}
      <Button onClick={onRetry ?? (() => window.location.reload())}>{retryLabel}</Button>
    </div>
  );
}
