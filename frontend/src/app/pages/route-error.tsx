import { QErrorState, QPageContainer } from '@qalam/ui';
import { useEffect, type ReactElement } from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';

import { NotFound } from '@/app/pages/not-found';
import { reportError } from '@/app/sentry';
import { getRequestId } from '@/lib/errors';

/**
 * Router `errorElement` (docs/11 §6): thrown Response(404) → NotFound (existence not leaked);
 * everything else → an in-place crash panel with retry + requestId, reported to Sentry.
 * Feature epics add finer per-route-group boundaries (e.g. draft-preserving editor).
 */
export function RouteErrorBoundary(): ReactElement {
  const error = useRouteError();
  const navigate = useNavigate();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!is404) reportError(error);
  }, [error, is404]);

  if (is404) return <NotFound />;

  return (
    <QPageContainer className="py-16">
      <QErrorState
        onRetry={() => {
          void navigate(0);
        }}
        requestId={getRequestId(error)}
      />
    </QPageContainer>
  );
}
