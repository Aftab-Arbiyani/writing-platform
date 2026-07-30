import { QCard, QSkeleton } from '@qalam/ui';
import type { ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { useStoryHistory } from '../hooks/use-publishing';
import { publicationEventLabel, visibilityLabel } from '../lib/publishing-labels';
import { CollaboratorIdentity } from './collaborator-identity';

/**
 * The story's immutable publishing history (AF6, W3c — docs/49 §5) — every submit, decision,
 * publish, schedule, visibility change, snapshot and revert, newest first.
 *
 * `metadata` is an open `jsonb` bag whose contents vary by event kind, so only the keys the server
 * demonstrably writes are read, and each one defensively: `visibility` on a visibility change,
 * `version` on a snapshot or revert. An event kind the client does not know renders its raw wire
 * type rather than disappearing — the catalogue is open by design.
 */
export interface PublicationHistoryProps {
  storyId: string;
}

/** Reads one known key out of the metadata bag without trusting its type. */
function metaString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function metaNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' ? value : undefined;
}

export function PublicationHistory({ storyId }: PublicationHistoryProps): ReactElement {
  const history = useStoryHistory(storyId);

  return (
    <QCard as="section" aria-labelledby="history-heading">
      <div className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-ink text-base font-semibold">
          Publication history
        </h2>

        {history.isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading publication history">
            <QSkeleton variant="text" lines={3} />
          </div>
        ) : history.isError ? (
          <p role="alert" className="text-danger text-sm">
            Couldn’t load the history. {getErrorMessage(history.error)}
          </p>
        ) : (history.data?.length ?? 0) === 0 ? (
          <p className="text-ink-muted text-sm">
            Nothing yet. Requesting a review or publishing writes the first entry.
          </p>
        ) : (
          <ol className="divide-line flex flex-col divide-y">
            {history.data?.map((event) => {
              const visibility = metaString(event.metadata, 'visibility');
              const version = metaNumber(event.metadata, 'version');
              return (
                <li key={event.id} className="flex flex-col gap-1 py-2">
                  <p className="text-ink text-sm font-medium">
                    {publicationEventLabel(event.type)}
                    {visibility ? (
                      <span className="text-ink-muted font-normal">
                        {' · '}
                        {visibilityLabel(visibility)}
                      </span>
                    ) : null}
                    {version !== undefined ? (
                      <span className="text-ink-muted font-normal">
                        {' · v'}
                        {version}
                      </span>
                    ) : null}
                  </p>
                  <div className="text-ink-muted flex flex-wrap items-center gap-2 text-xs">
                    <CollaboratorIdentity userId={event.actorId} />
                    <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </QCard>
  );
}
