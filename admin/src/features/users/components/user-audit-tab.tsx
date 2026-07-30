import { useState, type ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { Pagination } from '@/components/pagination';
import { getErrorMessage } from '@/lib/errors';

import { useUserAudit } from '../hooks/use-user';
import { AuditEntryRow } from './audit-entry-row';

/** Paginated administrative audit trail for a user (`GET /admin/users/:id/audit`). */
export function UserAuditTab({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}): ReactElement {
  const [page, setPage] = useState(1);
  const query = useUserAudit(userId, { page, limit: 20 }, active);

  if (query.isLoading) {
    return <LoadingState variant="rows" rows={6} />;
  }
  if (query.isError) {
    return <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  }

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="No audit history" description="No admin actions recorded yet." />;
  }

  const pagination = query.data?.pagination;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {items.map((entry) => (
          <AuditEntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      {pagination !== undefined && pagination.total > pagination.limit ? (
        <div className="flex justify-end">
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
