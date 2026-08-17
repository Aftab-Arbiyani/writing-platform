import { QErrorState } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { LoadingState } from '@/components/loading-state';
import { getErrorMessage, getRequestId } from '@/lib/errors';

/**
 * Per-section state wrapper for the monetization views (A1): a skeleton while a query first loads,
 * the house error panel (message + requestId + retry) on failure, otherwise the section body.
 *
 * A local copy rather than an import, because a feature may not import another feature
 * (`features/README.md` — the deletability rule) and this is the third such copy in the app, after
 * the Security / System / Operations slices. Duplicating ~40 lines is the price of `rm -rf` working;
 * lifting it to `src/components/` would be the alternative, but that is a refactor across four
 * features and not this row's to make.
 *
 * `isLoading` is React Query's FIRST-load flag, so a background refetch keeps content on screen.
 */
export interface AsyncSectionProps {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  loadingRows?: number;
  children: ReactNode;
}

export function AsyncSection({
  isLoading,
  error,
  onRetry,
  loadingRows = 4,
  children,
}: AsyncSectionProps): ReactElement {
  if (error) {
    return (
      <QErrorState
        description={getErrorMessage(error)}
        requestId={getRequestId(error)}
        onRetry={onRetry}
        minHeight={200}
      />
    );
  }
  if (isLoading) {
    return <LoadingState variant="rows" rows={loadingRows} />;
  }
  return <>{children}</>;
}
