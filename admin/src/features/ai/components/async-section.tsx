import { QErrorState } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { LoadingState } from '@/components/loading-state';
import { getErrorMessage, getRequestId } from '@/lib/errors';

/**
 * Per-section state wrapper for the AI admin views (A3): a skeleton while a query first loads, the
 * house error panel (message + requestId + retry) on failure, otherwise the section body.
 *
 * A local copy rather than an import, because a feature may not import another feature
 * (`features/README.md` — the deletability rule). This is the FIFTH copy, after Operations,
 * Security, System and monetization, and the monetization one already recorded the alternative:
 * lifting it to `src/components/` is a refactor across every one of those features, which is not a
 * feature row's to make. Recorded again here rather than quietly repeated, because five is the
 * number at which the refactor stops being hypothetical — see the A3 sweep.
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
