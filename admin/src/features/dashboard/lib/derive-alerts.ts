import type { AlertItem } from '@/components/alert-panel';

import type { QueueStatus, SystemNotification } from '../types/dashboard.types';

/**
 * Derives dashboard alerts client-side (the backend has no aggregated alerts endpoint). Signals:
 * failed jobs, paused queues, missing workers, and stalled backlogs from `/admin/queues`, plus
 * admin-authored broadcasts from `/admin/system-notifications`. Pure + testable.
 */
const STALL_THRESHOLD_MS = 5 * 60 * 1000;
const CRITICAL_FAILURES = 10;

export function deriveAlerts(
  queues: QueueStatus[],
  notifications: SystemNotification[],
): AlertItem[] {
  const alerts: AlertItem[] = [];

  for (const queue of queues) {
    if (queue.counts.failed > 0) {
      alerts.push({
        id: `failed-${queue.name}`,
        severity: queue.counts.failed >= CRITICAL_FAILURES ? 'critical' : 'warning',
        title: `${queue.counts.failed} failed job${queue.counts.failed === 1 ? '' : 's'} in "${queue.name}"`,
        description: 'Review and retry from the queue monitor.',
      });
    }
    if (queue.workers === 0 && queue.counts.waiting > 0) {
      alerts.push({
        id: `no-worker-${queue.name}`,
        severity: 'critical',
        title: `No workers on "${queue.name}"`,
        description: `${queue.counts.waiting} job${queue.counts.waiting === 1 ? '' : 's'} waiting with no worker connected.`,
      });
    } else if (queue.oldestWaitingAgeMs > STALL_THRESHOLD_MS) {
      alerts.push({
        id: `stalled-${queue.name}`,
        severity: 'warning',
        title: `"${queue.name}" has a stalled backlog`,
        description: 'A job has been waiting more than 5 minutes.',
      });
    }
    if (queue.paused) {
      alerts.push({
        id: `paused-${queue.name}`,
        severity: 'warning',
        title: `Queue "${queue.name}" is paused`,
      });
    }
  }

  for (const notification of notifications) {
    alerts.push({
      id: `notice-${notification.id}`,
      severity: 'info',
      title: notification.title,
      description: notification.body,
      timestamp: notification.createdAt,
    });
  }

  return alerts;
}
