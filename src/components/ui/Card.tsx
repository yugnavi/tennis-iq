import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'li'; children: ReactNode };

/** Light "paper" card used on the navy background. */
export function Card({ as: Tag = 'div', className = '', ...rest }: CardProps) {
  return (
    <Tag
      className={`pixel-card min-w-0 bg-card p-4 text-ink [overflow-wrap:anywhere] ${className}`}
      {...rest}
    />
  );
}
