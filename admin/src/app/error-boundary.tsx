import type { ReactElement } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { useRouteError } from 'react-router';

import { ServerError } from '@/app/pages/server-error';
import { getRequestId } from '@/lib/errors';

/**
 * Global render-error fallback (docs/11 §6) — wired into `react-error-boundary` in app/providers.
 * Catches any uncaught render error so the app never white-screens; offers a reset.
 */
export function RootErrorFallback({ resetErrorBoundary }: FallbackProps): ReactElement {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <ServerError onRetry={resetErrorBoundary} />
    </div>
  );
}

/**
 * Route-level error element for the shell (React Router `errorElement`). Catches errors thrown by a
 * section's loader/render and surfaces the requestId when it's an ApiError. Reload revalidates.
 */
export function AdminErrorBoundary(): ReactElement {
  const error = useRouteError();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <ServerError onRetry={() => window.location.reload()} requestId={getRequestId(error)} />
    </div>
  );
}
