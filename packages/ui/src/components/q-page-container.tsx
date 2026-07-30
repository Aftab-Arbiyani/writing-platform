import type { HTMLAttributes, ReactElement, Ref } from 'react';

import { cn } from '../lib/cn.js';

export interface QPageContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** reading = 68ch (prose), default = 720px, wide = 1280px (docs/06 §8, §11). */
  size?: 'reading' | 'default' | 'wide';
  ref?: Ref<HTMLDivElement>;
}

const MAX: Record<'reading' | 'default' | 'wide', string> = {
  reading: 'max-w-[68ch]',
  default: 'max-w-[720px]',
  wide: 'max-w-[1280px]',
};

/** Centered content column with responsive gutters (docs/06 §11). */
export function QPageContainer({
  size = 'default',
  className,
  ...rest
}: QPageContainerProps): ReactElement {
  return <div className={cn('mx-auto w-full px-4 sm:px-6', MAX[size], className)} {...rest} />;
}
