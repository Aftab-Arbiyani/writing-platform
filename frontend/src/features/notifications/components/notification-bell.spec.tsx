import { NotificationType } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { notificationsApi } from '../api/notifications.api';
import { useNotificationsStore } from '../stores/notifications.store';
import type { NotificationItem } from '../types/notification.types';
import { NotificationBell } from './notification-bell';

vi.mock('../api/notifications.api', () => ({
  notificationsApi: {
    unreadCount: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  },
}));

const api = vi.mocked(notificationsApi);

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

function pageOf(items: NotificationItem[]): CursorPage<NotificationItem> {
  return { items, meta: { nextCursor: null, hasMore: false } };
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    useNotificationsStore.setState({ popoverOpen: false });
    api.unreadCount.mockResolvedValue({ count: 3, capped: false });
    api.list.mockResolvedValue(pageOf([FOLLOW]));
  });

  it('announces the unread count to screen readers', async () => {
    renderWithProviders(<NotificationBell />);
    expect(await screen.findByRole('button', { name: /3 unread/ })).toBeInTheDocument();
  });

  it('opens the popover on click, showing recent notifications + a See all link', async () => {
    renderWithProviders(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all notifications' })).toBeInTheDocument();
    // The recent list resolves asynchronously inside the open popover.
    expect(
      await screen.findByRole('link', { name: /Meera started following you/ }),
    ).toBeInTheDocument();
  });
});
