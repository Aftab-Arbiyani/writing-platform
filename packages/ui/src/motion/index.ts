/**
 * `@qalam/ui/motion` — motion tokens, standard variants, and the reduced-motion provider.
 * Import variants from here (never inline `transition={{ duration }}` literals — docs/08 §5).
 */
export { MotionProvider } from './motion-provider.js';
export type { MotionProviderProps } from './motion-provider.js';
export {
  DURATION,
  EASING,
  fade,
  fadeRise,
  scaleIn,
  slideUp,
  pageTransition,
  clapBurst,
} from './variants.js';
