import { NotificationType } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import { groupByDate } from './group-by-date';
import type { NotificationItem } from '../types/notification.types';

function at(iso: string): NotificationItem {
  return {
    id: iso,
    type: NotificationType.Follow,
    status: 'read',
    actor: null,
    entityType: null,
    entityId: null,
    data: {},
    readAt: null,
    archivedAt: null,
    createdAt: iso,
  };
}

/** An ISO string `days` (+ `hours`) before now — anchored to the current run so buckets are stable. */
function ago(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

describe('groupByDate', () => {
  it('buckets notifications into Today / Yesterday / Older, preserving order', () => {
    const groups = groupByDate([at(ago(0, 1)), at(ago(1)), at(ago(40))]);
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Older']);
    expect(groups[0]?.items).toHaveLength(1);
  });

  it('omits empty buckets', () => {
    const groups = groupByDate([at(ago(0, 2)), at(ago(0, 3))]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Today');
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDate([])).toEqual([]);
  });
});
