import { QErrorState } from '@qalam/ui';
import type { ReactElement, ReactNode } from 'react';

import { LoadingState } from '@/components/loading-state';
import { getErrorMessage, getRequestId } from '@/lib/errors';

/**
 * Per-section state wrapper for the Operations views (P7.4): a skeleton while a query first loads,
 * the house error panel (message + requestId + retry) on failure, otherwise the section body. Each
 * page composes several independent queries, so this keeps one failing read from blanking the page
 * (mirrors the Security / System slices' `AsyncSection`). `isLoading` is React Query's first-load
 * flag, so a background refetch keeps the current content on screen.
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
