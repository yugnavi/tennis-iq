import type { PublicChallenge } from '../../types';
import { TRACK_LABELS } from '../../types';
import { Badge } from '../ui/Badge';
import { CourtView } from './CourtView';

type ScenePanelProps = {
  challenge: PublicChallenge;
  /** Reveal the recommended path (after answering). */
  revealed: boolean;
  /** When the challenge has no court: show the empty default court instead of a rules card. */
  fallback?: 'rules-card' | 'court';
};

const KIND_LABEL: Record<PublicChallenge['kind'], string> = {
  rules: 'Rules & scoring',
  'court-position': 'Court positioning',
  'shot-choice': 'Shot choice',
};

/** Court diagram when the question has one, otherwise a compact rules card. */
export function ScenePanel({ challenge, revealed, fallback = 'rules-card' }: ScenePanelProps) {
  if (challenge.court || fallback === 'court') {
    // The scene caption is shown as text by QuestionCard (`scenario`), right above the prompt.
    return <CourtView scene={challenge.court} highlight={revealed ? 'path' : 'none'} layout="stage" />;
  }
  return (
    <div className="pixel-card-green flex items-center gap-3 px-4 py-4 text-white">
      <Badge name={challenge.track} size={48} />
      <div className="min-w-0">
        <p className="font-pixel text-xs uppercase tracking-wide text-white/65">{TRACK_LABELS[challenge.track].title}</p>
        <p className="font-pixel text-lg font-semibold">{KIND_LABEL[challenge.kind]}</p>
      </div>
    </div>
  );
}
