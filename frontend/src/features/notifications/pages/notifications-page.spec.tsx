import { NotificationType } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { notificationsApi } from '../api/notifications.api';
import type { NotificationItem } from '../types/notification.types';
import { NotificationsPage } from './notifications-page';

vi.mock('../api/notifications.api', () => ({
  notificationsApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  },
}));

const api = vi.mocked(notificationsApi);

function page(items: NotificationItem[]): CursorPage<NotificationItem> {
  return { items, meta: { nextCursor: null, hasMore: false } };
}

const FOLLOW: NotificationItem = {
  id: 'n1',
  type: NotificationType.Follow,
  status: 'unread',
  actor: { username: 'meera_k', penName: 'Meera', avatarKey: null },
  entityType: 'user',
  entityId: 'u1',
  data: {},
  readAt: null,
  archivedAt: null,
  createdAt: new Date().toISOString(),
};

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    api.list.mockResolvedValue(page([FOLLOW]));
    api.unreadCount.mockResolvedValue({ count: 2, capped: false });
    api.markRead.mockResolvedValue(undefined);
    api.markAllRead.mockResolvedValue(undefined);
    api.archive.mockResolvedValue(undefined);
    api.remove.mockResolvedValue(undefined);
  });

  it('renders the inbox grouped by date', async () => {
    renderWithProviders(<NotificationsPage />, { route: '/notifications' });
    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Meera started following you/ })).toBeInTheDocument();
  });

  it('marks all read from the header', async () => {
    renderWithProviders(<NotificationsPage />, { route: '/notifications' });
    await screen.findByText('Today');
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    await waitFor(() => {
      expect(api.markAllRead).toHaveBeenCalledTimes(1);
    });
  });

  it('marks one notification read via its row action', async () => {
    renderWithProviders(<NotificationsPage />, { route: '/notifications' });
    await screen.findByText('Today');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => {
      expect(api.markRead).toHaveBeenCalledWith('n1');
    });
  });

  it('deletes a notification via its row action', async () => {
    renderWithProviders(<NotificationsPage />, { route: '/notifications' });
    await screen.findByText('Today');
    fireEvent.click(screen.getByRole('button', { name: 'Delete notification' }));
    await waitFor(() => {
      expect(api.remove).toHaveBeenCalledWith('n1');
    });
  });

  it('shows the empty state when the inbox is empty', async () => {
    api.list.mockResolvedValue(page([]));
    renderWithProviders(<NotificationsPage />, { route: '/notifications' });
    expect(await screen.findByText('All quiet.')).toBeInTheDocument();
  });
});
