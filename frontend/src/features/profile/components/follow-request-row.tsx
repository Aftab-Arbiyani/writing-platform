import { QButton, useToast } from '@qalam/ui';
import { Check, X } from 'lucide-react';
import type { ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import type { FollowRequest } from '@/types/profile';

import { useFollowRequestActions } from '../hooks/use-follow-requests';
import { UserSummaryRow } from './user-summary-row';

/**
 * A single incoming follow request with Accept / Reject actions (docs/06 §3.5). Each row owns its
 * own mutation pair so its buttons show independent loading; on success the requests list is
 * invalidated and the row falls away. `request.id` is the follow-ROW id passed to accept/reject
 * (NOT the requester's user id — docs/11 §10.3).
 */
export function FollowRequestRow({ request }: { request: FollowRequest }): ReactElement {
  const toast = useToast();
  const { accept, reject } = useFollowRequestActions();

  const onError = (err: unknown): void => {
    toast.error('Couldn’t update that request', { description: getErrorMessage(err) });
  };

  return (
    <UserSummaryRow
      user={request.requester}
      trailing={
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-ink-muted sm:inline">
            {formatRelativeTime(request.requestedAt)}
          </span>
          <QButton
            variant="secondary"
            size="sm"
            icon={X}
            aria-label={`Decline request from ${request.requester.penName ?? request.requester.username}`}
            loading={reject.isPending}
            disabled={accept.isPending}
            onClick={() => reject.mutate(request.id, { onError })}
          />
          <QButton
            variant="primary"
            size="sm"
            icon={Check}
            aria-label={`Accept request from ${request.requester.penName ?? request.requester.username}`}
            loading={accept.isPending}
            disabled={reject.isPending}
            onClick={() =>
              accept.mutate(request.id, {
                onSuccess: () =>
                  toast.success(
                    `${request.requester.penName ?? request.requester.username} now follows you`,
                  ),
                onError,
              })
            }
          >
            Accept
          </QButton>
        </div>
      }
    />
  );
}
