import { Spin } from 'antd';
import type { ReactElement, ReactNode } from 'react';

export interface QLoaderProps {
  label?: string;
}

/** Full-area loader for route-level Suspense fallbacks (docs/06 §4.3). */
export function QPageLoader({ label = 'Loading' }: QLoaderProps): ReactElement {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-[60vh] w-full items-center justify-center"
    >
      <Spin size="large" />
    </div>
  );
}

/** Smaller centered loader for a section within a page. */
export function QSectionLoader({ label = 'Loading' }: QLoaderProps): ReactElement {
  return (
    <div role="status" aria-label={label} className="flex w-full items-center justify-center py-12">
      <Spin />
    </div>
  );
}

export interface QLoadingOverlayProps {
  active: boolean;
  label?: string;
  children: ReactNode;
}

/** Overlays a spinner over its content while `active` (e.g. a submitting form region). */
export function QLoadingOverlay({
  active,
  label = 'Loading',
  children,
}: QLoadingOverlayProps): ReactElement {
  return (
    <div className="relative">
      {children}
      {active ? (
        <div
          role="status"
          aria-label={label}
          className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/60"
        >
          <Spin />
        </div>
      ) : null}
    </div>
  );
}
