import { QErrorState } from '@qalam/ui';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';

/**
 * 500 / unexpected-failure surface (docs/11 §6). Rendered by the global error boundary and the
 * route error boundary. Never a blank screen; offers a retry (reload or route revalidation).
 */
export interface ServerErrorProps {
  onRetry?: () => void;
  requestId?: string;
}

export function ServerError({ onRetry, requestId }: ServerErrorProps): ReactElement {
  usePageTitle('Something went wrong');
  return (
    <QErrorState
      title="Something went wrong."
      description="An unexpected error occurred. Your work is safe — try again, or reload the page."
      onRetry={onRetry}
      requestId={requestId}
      minHeight={420}
    />
  );
}
