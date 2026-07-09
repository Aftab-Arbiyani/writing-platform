import { QErrorState, QPageContainer } from '@qalam/ui';
import type { ReactElement } from 'react';
import type { FallbackProps } from 'react-error-boundary';

/**
 * Last-resort fallback for render crashes outside the router's reach (react-error-boundary
 * at the provider root). Errors are reported to Sentry via the boundary's `onError`.
 */
export function RootErrorFallback({ resetErrorBoundary }: FallbackProps): ReactElement {
  return (
    <QPageContainer className="py-16">
      <QErrorState
        title="Something broke."
        description="An unexpected error occurred. Your work is safe — please try again."
        onRetry={resetErrorBoundary}
      />
    </QPageContainer>
  );
}
