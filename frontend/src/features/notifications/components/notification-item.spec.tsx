import { NotificationType } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { NotificationRow } from './notification-item';
import type { NotificationItem } from '../types/notification.types';

function make(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: NotificationType.Follow,
    status: 'unread',
    actor: { username: 'meera_k', penName: 'Meera', avatarKey: null },
    entityType: 'user',
    entityId: 'u1',
    data: {},
    readAt: null,
    archivedAt: null,
    createdAt: '2026-07-10T10:00:00.000Z',
    ...over,
  };
}

function setup(over: Partial<NotificationItem> = {}) {
  const onOpen = vi.fn();
  const onMarkRead = vi.fn();
  const onArchive = vi.fn();
  const onDelete = vi.fn();
  renderWithProviders(
    <ul>
      <NotificationRow
        notification={make(over)}
        onOpen={onOpen}
        onMarkRead={onMarkRead}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    </ul>,
  );
  return { onOpen, onMarkRead, onArchive, onDelete };
}

describe('NotificationRow', () => {
  it('renders the message and links to the related resource', () => {
    const { onOpen } = setup();
    const link = screen.getByRole('link', { name: /Meera started following you/ });
    expect(link).toHaveAttribute('href', '/@meera_k');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows a Mark-as-read action only when unread, and fires it', () => {
    const { onMarkRead } = setup({ status: 'unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(onMarkRead).toHaveBeenCalledWith('n1');
  });

  it('hides Mark-as-read when already read', () => {
    setup({ status: 'read', readAt: '2026-07-10T11:00:00.000Z' });
    expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument();
  });

  it('archives and deletes via the row actions', () => {
    const { onArchive, onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Archive notification' }));
    expect(onArchive).toHaveBeenCalledWith('n1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete notification' }));
    expect(onDelete).toHaveBeenCalledWith('n1');
  });
});
