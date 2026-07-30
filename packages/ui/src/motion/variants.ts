import type { Variants } from 'framer-motion';

/**
 * Motion tokens + standard variants (docs/07 §5, §14). Durations/easings mirror the
 * `--q-motion-*` / `--q-ease-*` CSS tokens; seconds here because Framer Motion wants
 * seconds. Every feature animates through these variants — no inline duration/easing
 * literals in app or component code (docs/08 §5).
 *
 * Reduced motion is NOT handled here: it is applied once, globally, by `MotionProvider`
 * (`<MotionConfig reducedMotion="user">`), so a single switch degrades every variant.
 */

/** Durations in seconds (CSS token equivalents: 150 / 250 / 400 ms). */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

/** Cubic-bezier easings as Framer tuples (mirror --q-ease-*). */
export const EASING = {
  /** Default — quick start, soft landing. */
  standard: [0.2, 0, 0, 1],
  /** Entrances — decelerating ("settling on paper"). */
  out: [0.16, 1, 0.3, 1],
  /** Exits only — leave faster than they arrive. */
  in: [0.3, 0, 1, 1],
} as const;

/** Opacity + 8px rise. Cards mounting, toasts, "New pieces" pill, save bar. */
export const fadeRise: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASING.out } },
  exit: { opacity: 0, y: 8, transition: { duration: DURATION.fast, ease: EASING.in } },
};

/** Opacity only. Chrome show/hide, image reveals. */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

/** Opacity + subtle scale from the anchor. Dialogs, popovers, dropdowns. */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASING.out } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: DURATION.fast, ease: EASING.in } },
};

/** Slide up from the bottom edge. Mobile bottom sheets. */
export const slideUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASING.out } },
  exit: { opacity: 0, y: 24, transition: { duration: DURATION.fast, ease: EASING.in } },
};

/** Route change: exit fade (in-ease) → enter fade-rise (out-ease). No slides — a book doesn't slide. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASING.out } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASING.in } },
};

/** Count-chip pop, one per tap. The one spring in the system; disabled under reduced motion. */
export const clapBurst: Variants = {
  rest: { scale: 1 },
  burst: {
    scale: [1, 1.12, 1],
    transition: { duration: DURATION.slow, times: [0, 0.4, 1], ease: EASING.out },
  },
};
