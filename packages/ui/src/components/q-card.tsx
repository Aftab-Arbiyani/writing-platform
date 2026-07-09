import type { ElementType, HTMLAttributes, ReactElement, Ref } from 'react';

import { cn } from '../lib/cn.js';

export interface QCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'li';
  /** none | 16px | 24px (docs/07 §7.3). */
  padding?: 'none' | 'md' | 'lg';
  /** Hover elevation + focus-within ring; pair with a single inner link. */
  interactive?: boolean;
  ref?: Ref<HTMLElement>;
}

/**
 * Surface card (docs/07 §7.3). Warm surface + hairline border + soft shadow; dark mode
 * leans on border over shadow via the token values. Built custom — no AntD Card fights.
 */
export function QCard({
  as = 'div',
  padding = 'md',
  interactive = false,
  className,
  ...rest
}: QCardProps): ReactElement {
  // Cast to ElementType so the polymorphic tag accepts the shared HTMLElement props/ref.
  const Tag = as as ElementType;
  return (
    <Tag
      className={cn(
        'border-line rounded-md border bg-surface shadow-[var(--q-shadow-1)]',
        padding === 'md' && 'p-4',
        padding === 'lg' && 'p-6',
        interactive &&
          'transition-shadow duration-150 hover:shadow-[var(--q-shadow-2)] focus-within:shadow-[var(--q-shadow-2)]',
        className,
      )}
      {...rest}
    />
  );
}
