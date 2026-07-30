import { NotificationType } from '@qalam/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { describeNotification } from './describe-notification';
import type { NotificationItem } from '../types/notification.types';

function make(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: NotificationType.Follow,
    status: 'unread',
    actor: { username: 'meera_k', penName: 'Meera', avatarKey: null },
    entityType: 'user',
    entityId: 'u1',
    data: { actor: { username: 'meera_k', penName: 'Meera', avatarKey: null } },
    readAt: null,
    archivedAt: null,
    createdAt: '2026-07-10T10:00:00.000Z',
    ...over,
  };
}

/** Render a notification's message node to plain text for assertions. */
function messageText(n: NotificationItem): string {
  const { container } = render(<>{describeNotification(n).message}</>);
  return container.textContent ?? '';
}

describe('describeNotification', () => {
  it('follow → links to the actor profile', () => {
    const view = describeNotification(make({ type: NotificationType.Follow }));
    expect(messageText(make({ type: NotificationType.Follow }))).toContain(
      'Meera started following you',
    );
    expect(view.link).toBe('/@meera_k');
  });

  it('follow_request → links to the follow-requests inbox (where accept/decline lives)', () => {
    const view = describeNotification(make({ type: NotificationType.FollowRequest }));
    expect(view.link).toBe('/me/follow-requests');
  });

  it('clap on a piece → quotes the title and links to the reading view', () => {
    const n = make({
      type: NotificationType.Clap,
      entityType: 'piece',
      entityId: 'p1',
      data: {
        actor: { username: 'meera_k', penName: 'Meera', avatarKey: null },
        piece: { slug: 'barish', title: 'Barish' },
      },
    });
    expect(messageText(n)).toContain('clapped for');
    expect(messageText(n)).toContain('Barish');
    expect(describeNotification(n).link).toBe('/p/barish');
  });

  it('comment → surfaces the excerpt as the preview line', () => {
    const n = make({
      type: NotificationType.Comment,
      entityType: 'comment',
      entityId: 'c1',
      data: {
        actor: { username: 'meera_k', penName: 'Meera', avatarKey: null },
        piece: { slug: 'barish', title: 'Barish' },
        comment: { id: 'c1', excerpt: 'This moved me.' },
      },
    });
    const view = describeNotification(n);
    expect(view.preview).toBe('This moved me.');
    expect(view.link).toBe('/p/barish');
  });

  it('system → uses the broadcast title + body, with no actor', () => {
    const n = make({
      type: NotificationType.System,
      actor: null,
      entityType: 'system',
      entityId: 's1',
      data: { title: 'Welcome to Qalam', message: 'Your notebook awaits.' },
    });
    const view = describeNotification(n);
    expect(messageText(n)).toContain('Welcome to Qalam');
    expect(view.preview).toBe('Your notebook awaits.');
    expect(view.link).toBeNull();
  });

  it('assigns a type glyph + colour tone (the activity-timeline cue) to each type', () => {
    expect(describeNotification(make({ type: NotificationType.Clap })).tone).toBe('accent');
    expect(describeNotification(make({ type: NotificationType.Like })).tone).toBe('danger');
    expect(describeNotification(make({ type: NotificationType.Follow })).tone).toBe('success');
    expect(describeNotification(make({ type: NotificationType.Comment })).icon).toBeDefined();
  });

  it('falls back to a piece id link when the slug is absent', () => {
    const n = make({
      type: NotificationType.Like,
      entityType: 'piece',
      entityId: 'p9',
      data: {
        actor: { username: 'meera_k', penName: 'Meera', avatarKey: null },
        piece: { slug: null, title: 'Untitled' },
      },
    });
    expect(describeNotification(n).link).toBe('/p/p9');
  });
});
