import { ASSETS } from './assets';

export type BadgeName = keyof typeof ASSETS.badges;

/** Decorative v3 rank/track emblem (160×160 pixel art, tightly framed). */
export function Badge({ name, size = 48, className = '' }: { name: BadgeName; size?: number; className?: string }) {
  return (
    <img
      src={ASSETS.badges[name]}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className={`pixelated inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
