import type { ReactElement } from 'react';

import { LoadingState } from '@/components/loading-state';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { useReportTimeline } from '../hooks/use-reports';

/**
 * A report's chronological timeline from the dedicated E12.7 endpoint (actions +
 * notes merged). Lazily fetched — `enabled` is driven by the active drawer tab.
 */
export function ReportTimeline({
  reportId,
  enabled,
}: {
  reportId: string;
  enabled: boolean;
}): ReactElement {
  const query = useReportTimeline(reportId, enabled);

  if (query.isLoading) {
    return <LoadingState variant="rows" rows={6} />;
  }
  if (query.isError) {
    return <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  }
  const entries = query.data ?? [];
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No timeline entries yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <li
          key={entry.auditRef ?? `${entry.kind}-${index}`}
          className="rounded-md border border-line bg-surface p-2 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-ink">
              {entry.kind === 'note' ? 'note' : (entry.action ?? 'action')}
            </span>
            <span className="text-xs text-ink-muted">{formatDateTime(entry.at)}</span>
          </div>
          {entry.body !== null ? <div className="mt-1 text-ink">{entry.body}</div> : null}
          {entry.actorId !== null ? (
            <div className="text-xs text-ink-muted">
              by {entry.actorId.slice(0, 8)}
              {entry.actorRole !== null ? ` · ${entry.actorRole}` : ''}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
