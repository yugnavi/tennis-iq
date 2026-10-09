import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pixel';
export type ButtonSize = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-none font-semibold text-center select-none ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ball focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-navy-900 disabled:cursor-not-allowed disabled:opacity-60 break-words';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-pixel text-white',
  secondary: 'btn-pixel-secondary',
  ghost: 'bg-transparent text-white border-2 border-white/30 hover:bg-white/10',
  /** Chunky 16-bit style CTA (see .btn-pixel in index.css). */
  pixel: 'btn-pixel text-white',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 py-2 text-base',
  lg: 'min-h-14 px-6 py-3 text-lg',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

export function Button({ variant, size, block, className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, `${block ? 'w-full' : ''} ${className}`)} {...rest} />;
}

type ButtonLinkProps = LinkProps & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

/** A navigation link styled as a button (keeps real link semantics). */
export function ButtonLink({ variant, size, block, className = '', ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, `${block ? 'w-full' : ''} ${className}`)} {...rest} />;
}
