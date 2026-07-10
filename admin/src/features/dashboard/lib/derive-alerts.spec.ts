import { describe, expect, it } from 'vitest';

import type { QueueStatus, SystemNotification } from '../types/dashboard.types';
import { deriveAlerts } from './derive-alerts';

function queue(over: Partial<QueueStatus> & { name: string }): QueueStatus {
  return {
    paused: false,
    counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
    oldestWaitingAgeMs: 0,
    workers: 1,
    ...over,
  };
}

const notice: SystemNotification = {
  id: 'n1',
  title: 'Scheduled maintenance',
  body: 'Tonight at 22:00 UTC.',
  audience: 'all',
  createdBy: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  deliveredCount: 0,
};

describe('deriveAlerts', () => {
  it('flags failed jobs (critical at the threshold), missing workers, stalls, paused queues, and notices', () => {
    const alerts = deriveAlerts(
      [
        queue({
          name: 'email',
          counts: { waiting: 0, active: 0, completed: 0, failed: 12, delayed: 0, paused: 0 },
        }),
        queue({
          name: 'idx',
          workers: 0,
          counts: { waiting: 5, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        }),
        queue({
          name: 'slow',
          oldestWaitingAgeMs: 10 * 60 * 1000,
          counts: { waiting: 1, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        }),
        queue({ name: 'paused-q', paused: true }),
      ],
      [notice],
    );

    expect(alerts.find((a) => a.id === 'failed-email')?.severity).toBe('critical');
    expect(alerts.find((a) => a.id === 'no-worker-idx')?.severity).toBe('critical');
    expect(alerts.some((a) => a.id === 'stalled-slow')).toBe(true);
    expect(alerts.some((a) => a.id === 'paused-paused-q')).toBe(true);
    expect(alerts.find((a) => a.id === 'notice-n1')?.severity).toBe('info');
  });

  it('returns no alerts for healthy queues and no notices', () => {
    expect(
      deriveAlerts(
        [
          queue({
            name: 'ok',
            counts: { waiting: 0, active: 1, completed: 9, failed: 0, delayed: 0, paused: 0 },
          }),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it('treats a small failure count as a warning, not critical', () => {
    const alerts = deriveAlerts(
      [
        queue({
          name: 'email',
          counts: { waiting: 0, active: 0, completed: 0, failed: 2, delayed: 0, paused: 0 },
        }),
      ],
      [],
    );
    expect(alerts[0]?.severity).toBe('warning');
  });
});
