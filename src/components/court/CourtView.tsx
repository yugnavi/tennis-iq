import type { CSSProperties, ReactNode } from 'react';
import type { CourtPoint, CourtScene } from '../../types';
import { COURT_LANDMARKS } from '../../types';
import { ASSETS } from '../ui/assets';

export type CourtSurface = 'hard' | 'clay' | 'grass' | 'indoor';

export type CourtViewProps = {
  scene?: CourtScene;
  surface?: CourtSurface;
  /** 'path' reveals scene.recommendedPath (only after answering — it may give the answer away). */
  highlight?: 'path' | 'none';
  /**
   * 'stacked': large court with the caption underneath (standalone views).
   * 'stage': court centred on a green stadium panel with a compact legend; the caption is NOT
   * shown here (still in the aria-label), so the page must show it as text (QuestionCard `scenario`).
   * 'backdrop': oversized stage court for screens that overlay question UI on top.
   */
  layout?: 'stacked' | 'stage' | 'backdrop';
  className?: string;
};

/** Idle positions used when no scene is supplied: both players centred behind their baselines. */
export const DEFAULT_SCENE_POINTS: { player: CourtPoint; opponent: CourtPoint } = {
  player: { x: COURT_LANDMARKS.centerX, y: COURT_LANDMARKS.nearBaselineY - 2 },
  opponent: { x: COURT_LANDMARKS.centerX, y: COURT_LANDMARKS.farBaselineY + 2 },
};

const DEFAULT_CAPTION =
  'Empty court: you stand at the centre of the near (bottom) baseline; your opponent is at the centre of the far (top) baseline.';

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Absolute position of a normalized point inside the court box (centre-anchored). */
export function pointStyle(p: CourtPoint): CSSProperties {
  return { left: `${clamp(p.x)}%`, top: `${clamp(p.y)}%`, transform: 'translate(-50%, -50%)' };
}

function PlayerMarker({ point, who, sprite }: { point: CourtPoint; who: 'player' | 'opponent'; sprite: string }) {
  const dot = who === 'player' ? 'bg-cta-500' : 'bg-wrong';
  return (
    <>
      {/* Precise position dot: the exact normalized spot, drawn on the court surface. */}
      <span
        aria-hidden="true"
        data-testid={`court-${who}`}
        className={`pixel-dot pointer-events-none absolute block h-3.5 w-3.5 ${dot}`}
        style={pointStyle(point)}
      />
      {/* Decorative v3 idle sprite standing on the dot (192×256 frame, feet ≈ y=247). Side-on art,
          not a physics position. */}
      <img
        src={sprite}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pixelated pointer-events-none absolute select-none"
        style={{
          left: `${clamp(point.x)}%`,
          top: `${clamp(point.y)}%`,
          transform: 'translate(-50%, -96%)',
          width: '21%',
          height: 'auto',
          aspectRatio: '192 / 256',
        }}
      />
    </>
  );
}

function pathD(points: CourtPoint[]): string {
  // Smooth curve through the points (quadratic segments via midpoints).
  if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'} ${clamp(p.x)} ${clamp(p.y)}`).join(' ');
  const [first, ...rest] = points;
  let d = `M ${clamp(first!.x)} ${clamp(first!.y)}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const c = rest[i]!;
    const n = rest[i + 1]!;
    d += ` Q ${clamp(c.x)} ${clamp(c.y)} ${(clamp(c.x) + clamp(n.x)) / 2} ${(clamp(c.y) + clamp(n.y)) / 2}`;
  }
  const last = rest[rest.length - 1]!;
  return `${d} L ${clamp(last.x)} ${clamp(last.y)}`;
}

/**
 * Portrait tactical court. Base layer is courts/gameplay/<surface>.svg (360×580); markers are
 * positioned with normalized 0..100 percentages of that same box, so coordinates map exactly.
 * The scene caption is rendered as visible text for an accessible, non-visual description.
 */
const LAYOUT = {
  stacked: {
    figure: 'flex-col items-center gap-2 pt-7',
    // Width derived from a max height (≈46% of the small viewport) so the ratio never breaks.
    width: 'min(100%, max(150px, calc(46svh * 360 / 580)))',
    caption: 'w-full text-sm',
    legend: 'mt-1 flex flex-wrap gap-x-3 gap-y-1',
  },
  stage: {
    figure: 'pixel-card-green relative flex-col items-center overflow-hidden pb-9',
    // Width of the v3 stadium frame (720×1200): ~32% of the viewport height tall, so question + answers fit.
    width: 'max(130px, calc(min(32svh, 300px) * 720 / 1200))',
    caption: '',
    legend: 'absolute bottom-2 left-2 right-2 flex flex-wrap justify-center gap-x-3 gap-y-1 bg-black/35 px-3 py-1',
  },
  backdrop: {
    figure: 'absolute inset-x-0 top-0 z-0 flex-col items-center overflow-hidden opacity-80',
    // Large enough to read as the scene backdrop, while leaving the bottom question panel legible.
    width: 'min(94vw, calc(76svh * 720 / 1200))',
    caption: '',
    legend: 'sr-only',
  },
} as const;

/**
 * The v3 court art (720×1200) has its playing surface inside x 68–656, y 140–1116 but no doubles
 * alleys, so the exact tactical SVG is laid over that area at its own 360:580 ratio, centred.
 */
const STAGE_COURT: CSSProperties = {
  left: '9.444%',
  width: '81.667%',
  top: '52.33%',
  transform: 'translateY(-50%)',
  aspectRatio: '360 / 580',
};

function CourtFrame({ on, width, children }: { on: boolean; width: string; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <div
      className="pixelated relative shrink-0"
      style={{
        width,
        aspectRatio: '720 / 1200',
        backgroundImage: `url(${ASSETS.courtFrame})`,
        backgroundSize: '100% 100%',
      }}
    >
      {children}
    </div>
  );
}

export function CourtView({ scene, surface = 'hard', highlight = 'none', layout = 'stacked', className = '' }: CourtViewProps) {
  const L = LAYOUT[layout];
  const player = scene?.player ?? DEFAULT_SCENE_POINTS.player;
  const opponent = scene?.opponent ?? DEFAULT_SCENE_POINTS.opponent;
  const caption = scene?.caption ?? DEFAULT_CAPTION;
  const path = highlight === 'path' && scene?.recommendedPath && scene.recommendedPath.length >= 2 ? scene.recommendedPath : undefined;
  const pathEnd = path?.[path.length - 1];

  return (
    <figure className={`m-0 flex min-w-0 ${L.figure} ${className}`}>
      <CourtFrame on={layout === 'stage' || layout === 'backdrop'} width={L.width}>
      <div
        role="img"
        aria-label={`Court diagram. ${caption}${path ? ' The dashed line shows the recommended path.' : ''}`}
        data-testid="court"
        className={layout === 'stage' || layout === 'backdrop' ? 'absolute overflow-visible' : 'relative shrink-0 overflow-visible shadow-lg'}
        style={layout === 'stage' || layout === 'backdrop' ? STAGE_COURT : { aspectRatio: '360 / 580', width: L.width }}
      >
        <img
          src={ASSETS.court(surface)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />

        {path && (
          <svg
            aria-hidden="true"
            data-testid="court-path"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <path
              d={pathD(path)}
              fill="none"
              stroke="#d8f046"
              strokeWidth={3}
              strokeDasharray="7 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {pathEnd && (
          <span
            aria-hidden="true"
            className="pixel-target pointer-events-none absolute block h-4 w-4 bg-ball/30"
            style={pointStyle(pathEnd)}
          />
        )}

        <PlayerMarker point={opponent} who="opponent" sprite={ASSETS.opponent} />
        <PlayerMarker point={player} who="player" sprite={ASSETS.playerIdle} />

        {scene?.ball && (
          <span
            aria-hidden="true"
            data-testid="court-ball"
            className="pixel-dot pointer-events-none absolute block h-3.5 w-3.5 bg-ball"
            style={pointStyle(scene.ball)}
          />
        )}
      </div>
      </CourtFrame>
      <figcaption className={layout === 'stage' || layout === 'backdrop' ? 'contents' : `bg-navy-800/80 px-3 py-2 text-white/90 ${L.caption}`}>
        {layout !== 'stage' && layout !== 'backdrop' && (
          <>
            <span className="sr-only">Court description: </span>
            {caption}
          </>
        )}
        <span className={`text-xs text-white/85 ${L.legend}`} aria-hidden="true">
          <span>
            <span className="pixel-dot mr-1 inline-block h-2.5 w-2.5 bg-cta-500" />
            You
          </span>
          <span>
            <span className="pixel-dot mr-1 inline-block h-2.5 w-2.5 bg-wrong" />
            Opponent
          </span>
          {scene?.ball && (
            <span>
              <span className="pixel-dot mr-1 inline-block h-2.5 w-2.5 bg-ball" />
              Ball
            </span>
          )}
          {path && <span className="text-ball">- - - Best path</span>}
        </span>
      </figcaption>
    </figure>
  );
}
