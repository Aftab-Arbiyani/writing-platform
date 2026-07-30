import { QButton, QCard, QEmptyState, QErrorState, QSkeleton } from '@qalam/ui';
import { BarChart3, PenLine, WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { getErrorMessage, getRequestId } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';
import { useAppStore } from '@/stores/app.store';

/**
 * No published pieces yet — the dashboard's primary empty state, with the docs/06 §3.10 copy
 * verbatim ("Numbers need words first…"). A writer with no published work has nothing to measure.
 */
export function NoPublishedPieces(): ReactElement {
  const navigate = useNavigate();
  return (
    <QEmptyState
      icon={BarChart3}
      title="Numbers need words first."
      description="Publish your first piece and this page will start keeping count."
      action={
        <QButton
          variant="primary"
          icon={PenLine}
          onClick={() => {
            void navigate(ROUTES.write);
          }}
        >
          Start writing
        </QButton>
      }
    />
  );
}

/** Analytics load error — offline-aware, with a retry (docs: error handling + offline). */
export function AnalyticsError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}): ReactElement {
  const isOnline = useAppStore((s) => s.isOnline);
  if (!isOnline) {
    return (
      <QEmptyState
        icon={WifiOff}
        title="You're offline."
        description="Your stats will load as soon as you're reconnected."
      />
    );
  }
  return (
    <QErrorState
      title="Couldn't load your analytics."
      description={getErrorMessage(error)}
      requestId={getRequestId(error)}
      onRetry={onRetry}
    />
  );
}

/** Skeleton for the overview grid + the growth chart (docs: skeleton cards + charts). */
export function DashboardSkeleton(): ReactElement {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <QCard key={i} padding="md" className="flex flex-col gap-3">
            <QSkeleton variant="text" lines={1} width="60%" />
            <QSkeleton variant="title" width="45%" />
          </QCard>
        ))}
      </div>
      <QCard padding="lg">
        <QSkeleton variant="rect" height={260} radius="md" />
      </QCard>
    </div>
  );
}
