import { QButton } from '@qalam/ui';
import { AlertTriangle, BarChart3, WifiOff } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { getErrorMessage } from '@/lib/errors';
import { isApiError } from '@/lib/errors';

import { AnalyticsSkeleton } from './analytics-skeleton';

interface SectionStateProps {
  loading: boolean;
  error: Error | null;
  /** True when the query resolved but there is nothing to show. */
  isEmpty?: boolean;
  onRetry: () => void;
  metrics?: number;
  charts?: number;
  children: ReactNode;
}

/**
 * Wraps a section's render with its loading / error / offline / unauthorized /
 * empty states (A8). First load shows a skeleton; a failed load distinguishes
 * offline, forbidden (403), and generic errors, each with a retry where useful.
 */
export function SectionState({
  loading,
  error,
  isEmpty = false,
  onRetry,
  metrics,
  charts,
  children,
}: SectionStateProps): ReactElement {
  if (loading) {
    return <AnalyticsSkeleton metrics={metrics} charts={charts} />;
  }
  if (error !== null) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    const forbidden = isApiError(error) && error.status === 403;
    if (forbidden) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Not authorized"
          description="You don’t have permission to view platform analytics."
        />
      );
    }
    return (
      <EmptyState
        icon={offline ? WifiOff : AlertTriangle}
        title={offline ? 'You’re offline' : 'Couldn’t load analytics'}
        description={offline ? 'Reconnect to load platform analytics.' : getErrorMessage(error)}
        action={
          <QButton variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </QButton>
        }
      />
    );
  }
  if (isEmpty) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics yet"
        description="There’s no activity in this range."
      />
    );
  }
  return <>{children}</>;
}
