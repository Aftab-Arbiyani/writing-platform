import { QErrorState } from '@qalam/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { DashboardCard } from '@/components/dashboard-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { getErrorMessage, getRequestId } from '@/lib/errors';

/**
 * A dashboard widget shell with independent, widget-level state handling: loading skeleton, error
 * panel (retry + requestId), empty state, and optional collapse. Each widget owns its own query, so
 * these states are per-widget (one failing widget never blanks the dashboard). Collapse is
 * controlled (the page wires it to the dashboard store) so this stays presentational + reusable.
 */
export interface WidgetContainerProps {
  title: string;
  action?: ReactNode;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  loadingVariant?: 'spinner' | 'rows';
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
}

export function WidgetContainer({
  title,
  action,
  isLoading = false,
  error,
  onRetry,
  isEmpty = false,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  loadingVariant = 'rows',
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  children,
}: WidgetContainerProps): ReactElement {
  const headerAction = (
    <div className="flex items-center gap-1">
      {action}
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          className="flex items-center rounded-md p-1 text-ink-muted hover:bg-raised hover:text-ink-secondary"
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden />
          ) : (
            <ChevronDown size={16} aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );

  function body(): ReactNode {
    if (isLoading) return <LoadingState variant={loadingVariant} />;
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
    if (isEmpty)
      return <EmptyState title={emptyTitle} description={emptyDescription} minHeight={200} />;
    return children;
  }

  return (
    <DashboardCard title={title} action={headerAction}>
      {collapsed ? null : body()}
    </DashboardCard>
  );
}
