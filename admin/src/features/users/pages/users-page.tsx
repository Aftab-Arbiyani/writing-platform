import { useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { DataTable } from '@/components/data-table';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { useAdminTable } from '@/hooks/use-admin-table';
import { useMe } from '@/hooks/use-me';
import { getErrorMessage } from '@/lib/errors';

import { downloadUserExport } from '../api/users.api';
import { buildUserColumns } from '../components/user-columns';
import { ConfirmActionDialog } from '../components/confirm-action-dialog';
import { needsConfirmation, type ConfirmableAction } from '../components/confirm-action-meta';
import { EditUserModal } from '../components/edit-user-modal';
import { UserBulkBar } from '../components/user-bulk-bar';
import { UserDetailDrawer } from '../components/user-detail-drawer';
import { UsersFilters } from '../components/users-filters';
import { UsersToolbar } from '../components/users-toolbar';
import { useUserAction } from '../hooks/use-user-mutations';
import { useUsers } from '../hooks/use-users';
import { useUsersTablePrefs } from '../stores/users-table-prefs.store';
import { DEFAULT_USER_SORT, USER_FILTER_KEYS } from '../users.constants';
import type { AdminUserListItem, UserAction, UserListParams } from '../types/users.types';

/**
 * Admin User Management (Epic A4). Composes the URL-driven table state
 * (`useAdminTable`) with the `/admin/users` query and the shared table primitives.
 * Pagination + filters + sort live in the URL; column visibility/density/saved
 * views in the prefs store; row selection is local. Every mutation reports via a
 * toast and invalidates the cache; destructive actions confirm with consequences.
 */
export function UsersPage(): ReactElement {
  const table = useAdminTable(USER_FILTER_KEYS, 20);
  const prefs = useUsersTablePrefs();
  const toast = useToast();
  const me = useMe();
  const currentUserId = me.data?.id ?? null;
  const action = useUserAction();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState<AdminUserListItem | null>(null);
  const [editUser, setEditUser] = useState<AdminUserListItem | null>(null);
  const [pending, setPending] = useState<{
    user: AdminUserListItem;
    action: ConfirmableAction;
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  const sort = table.filters.values.sort ?? DEFAULT_USER_SORT;
  const params: UserListParams = {
    page: table.pagination.page,
    limit: table.pagination.limit,
    ...table.filters.values,
  };
  const query = useUsers(params);

  const runAction = (user: AdminUserListItem, act: UserAction): void => {
    if (needsConfirmation(act)) {
      setPending({ user, action: act });
      return;
    }
    action.mutate(
      { id: user.id, action: act },
      {
        onSuccess: (result) => toast.success(result.message),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const columns = buildUserColumns({
    hiddenColumns: prefs.hiddenColumns,
    sort,
    currentUserId,
    onView: setDrawerUser,
    onEdit: setEditUser,
    onAction: runAction,
  });

  const onSortChange = (key: string | undefined, order: 'asc' | 'desc' | undefined): void => {
    table.filters.setFilter(
      'sort',
      order === undefined || key === undefined ? undefined : order === 'desc' ? `-${key}` : key,
    );
  };

  const onExport = (format: 'csv' | 'json'): void => {
    setExporting(true);
    downloadUserExport(params, format)
      .then(() => toast.success(`Export ready (${format.toUpperCase()}).`))
      .catch(() => toast.error('Export failed. Please try again.'))
      .finally(() => setExporting(false));
  };

  const isFiltered = USER_FILTER_KEYS.some(
    (key) => key !== 'sort' && table.filters.values[key] !== undefined,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Accounts, verification, roles, status, and moderation."
      />

      <UsersToolbar
        search={table.filters.values.q ?? ''}
        onSearchChange={(value) => table.filters.setFilter('q', value || undefined)}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        onRefresh={() => void query.refetch()}
        isFetching={query.isFetching}
        onExport={onExport}
        onPrint={() => window.print()}
        exporting={exporting}
      />

      {filtersOpen ? <UsersFilters filters={table.filters} /> : null}

      <UserBulkBar selection={table.selection} />

      <DataTable<AdminUserListItem>
        columns={columns}
        data={query.data?.items ?? []}
        rowKey="id"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={isFiltered ? 'No users match these filters' : 'No users yet'}
        emptyDescription={
          isFiltered ? 'Try clearing a filter or broadening your search.' : undefined
        }
        page={table.pagination.page}
        limit={table.pagination.limit}
        total={query.data?.pagination?.total ?? 0}
        onPageChange={table.pagination.setPage}
        onLimitChange={table.pagination.setLimit}
        selection={table.selection}
        density={prefs.density}
        onSortChange={onSortChange}
      />

      <UserDetailDrawer
        user={drawerUser}
        onClose={() => setDrawerUser(null)}
        onEdit={() => {
          if (drawerUser !== null) {
            setEditUser(drawerUser);
          }
        }}
      />

      {editUser !== null ? (
        <EditUserModal
          user={editUser}
          isSelf={editUser.id === currentUserId}
          open
          onClose={() => setEditUser(null)}
        />
      ) : null}

      <ConfirmActionDialog pending={pending} onClose={() => setPending(null)} />
    </PageContainer>
  );
}
