import type { CSSProperties, ReactElement } from 'react';

import { cn } from '../lib/cn.js';

export interface QSkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'rect';
  /** `text` variant: number of lines; last line renders 60% width. */
  lines?: number;
  width?: number | string;
  height?: number | string;
  avatarSize?: 32 | 48 | 80;
  radius?: 'sm' | 'md' | 'full';
  /** Default true; the pulse auto-disables under reduced motion. */
  animated?: boolean;
  className?: string;
}

const RADIUS: Record<'sm' | 'md' | 'full', string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  full: 'rounded-full',
};

const dim = (value: number | string | undefined): string | undefined =>
  typeof value === 'number' ? `${String(value)}px` : value;

/**
 * Warm-token skeleton (docs/07 §7.8). Custom — AntD's shimmer is cool-gray. Pulse is
 * gated behind `motion-reduce:animate-none` so it goes static under reduced motion.
 */
export function QSkeleton({
  variant = 'text',
  lines = 3,
  width,
  height,
  avatarSize = 48,
  radius,
  animated = true,
  className,
}: QSkeletonProps): ReactElement {
  const pulse = animated ? 'animate-pulse motion-reduce:animate-none' : '';
  const base = cn('bg-raised', pulse);

  if (variant === 'avatar') {
    return (
      <span
        aria-hidden
        className={cn(base, 'block rounded-full', className)}
        style={{ width: avatarSize, height: avatarSize }}
      />
    );
  }

  if (variant === 'title') {
    return (
      <span
        aria-hidden
        className={cn(base, RADIUS[radius ?? 'sm'], 'block h-6', className)}
        style={{ width: dim(width) ?? '60%' }}
      />
    );
  }

  if (variant === 'rect') {
    const style: CSSProperties = { width: dim(width) ?? '100%', height: dim(height) ?? 120 };
    return (
      <span
        aria-hidden
        className={cn(base, RADIUS[radius ?? 'md'], 'block', className)}
        style={style}
      />
    );
  }

  // text
  return (
    <span aria-hidden className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className={cn(base, RADIUS[radius ?? 'sm'], 'block h-3.5')}
          style={{ width: i === lines - 1 ? '60%' : (dim(width) ?? '100%') }}
        />
      ))}
    </span>
  );
}
