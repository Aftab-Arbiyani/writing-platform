import { NotificationStatus, NotificationType } from '@qalam/shared';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * The URL is the source of truth for the inbox's status + type filters (hard-rule #4, docs/11 §5)
 * — a shared `/notifications?status=unread&type=mention` reproduces the exact view. Both map 1:1
 * to the `GET /notifications` query params (the backend can't filter by a category GROUP, so each
 * filter is a single status or type — honest to the contract). `status=all` / `type=all` omit the
 * param. Cursors are never in the URL (opaque; TanStack pageParam).
 */

/** Inbox status views (maps to `?status=`; `all` = the active inbox, unread + read). */
export type InboxStatus = 'all' | NotificationStatus;
const STATUSES: readonly InboxStatus[] = [
  'all',
  NotificationStatus.Unread,
  NotificationStatus.Read,
  NotificationStatus.Archived,
];

/** Type filter (maps to `?type=`; `all` = every type). */
export type InboxType = 'all' | NotificationType;
const TYPES = Object.values(NotificationType);

function isStatus(value: string | null): value is InboxStatus {
  return value !== null && (STATUSES as readonly string[]).includes(value);
}
function isType(value: string | null): value is NotificationType {
  return value !== null && (TYPES as string[]).includes(value);
}

export interface UseNotificationParamsResult {
  status: InboxStatus;
  type: InboxType;
  /** The status param the api layer gets (undefined when `all`). */
  statusParam: NotificationStatus | undefined;
  /** The type param the api layer gets (undefined when `all`). */
  typeParam: NotificationType | undefined;
  hasActiveFilters: boolean;
  setStatus: (status: InboxStatus) => void;
  setType: (type: InboxType) => void;
  clearFilters: () => void;
}

export function useNotificationParams(): UseNotificationParamsResult {
  const [params, setParams] = useSearchParams();

  const status: InboxStatus = isStatus(params.get('status'))
    ? (params.get('status') as InboxStatus)
    : 'all';
  const type: InboxType = isType(params.get('type'))
    ? (params.get('type') as NotificationType)
    : 'all';

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '' || value === 'all') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    status,
    type,
    statusParam: status === 'all' ? undefined : status,
    typeParam: type === 'all' ? undefined : type,
    hasActiveFilters: status !== 'all' || type !== 'all',
    setStatus: (value) => {
      update({ status: value });
    },
    setType: (value) => {
      update({ type: value });
    },
    clearFilters: () => {
      update({ status: null, type: null });
    },
  };
}
