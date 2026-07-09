import { MotionConfig } from 'framer-motion';
import type { ReactElement, ReactNode } from 'react';

export interface MotionProviderProps {
  children: ReactNode;
}

/**
 * App-wide motion policy (docs/07 §5, §14). `reducedMotion="user"` makes Framer honor
 * `prefers-reduced-motion` globally: transform-based animation collapses to opacity, so
 * every shared variant degrades in one place instead of per component. Mount once, high
 * in the provider tree (inside the AntD ConfigProvider).
 */
export function MotionProvider({ children }: MotionProviderProps): ReactElement {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
