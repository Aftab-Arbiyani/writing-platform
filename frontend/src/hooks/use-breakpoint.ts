import { useEffect, useState } from 'react';

/** Tailwind default breakpoints (docs/06 §8, docs/07 §8) — no custom breakpoints, ever. */
export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const WIDTHS: Record<Exclude<Breakpoint, 'base'>, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

function toBreakpoint(width: number): Breakpoint {
  if (width >= WIDTHS['2xl']) return '2xl';
  if (width >= WIDTHS.xl) return 'xl';
  if (width >= WIDTHS.lg) return 'lg';
  if (width >= WIDTHS.md) return 'md';
  if (width >= WIDTHS.sm) return 'sm';
  return 'base';
}

export interface UseBreakpointResult {
  width: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/**
 * Reactive viewport breakpoint. Prefer CSS (Tailwind `sm:`/`md:`/`lg:`) for styling;
 * use this only where layout LOGIC must branch (e.g. Drawer vs bottom sheet, docs/36 §8).
 */
export function useBreakpoint(): UseBreakpointResult {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = (): void => {
      setWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return {
    width,
    breakpoint: toBreakpoint(width),
    isMobile: width < WIDTHS.md,
    isTablet: width >= WIDTHS.md && width < WIDTHS.lg,
    isDesktop: width >= WIDTHS.lg,
  };
}
