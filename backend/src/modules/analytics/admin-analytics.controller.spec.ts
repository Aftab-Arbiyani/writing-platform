import 'reflect-metadata';
import { PERMISSIONS } from '@qalam/shared';
import type { Request, Response } from 'express';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';
import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdminAnalyticsController } from './admin-analytics.controller';
import type { AnalyticsService } from './analytics.service';
import { AdminAnalyticsExportQueryDto } from './dto/admin-analytics-query.dto';

/** Reads the `@Permissions(...)` codes a route handler declares (PBAC). */
function permsOf(handler: (...args: never[]) => unknown): unknown {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler);
}

describe('AdminAnalyticsController — PBAC', () => {
  const routes: Array<[string, (...args: never[]) => unknown]> = [
    ['overview', AdminAnalyticsController.prototype.overview],
    ['users', AdminAnalyticsController.prototype.users],
    ['content', AdminAnalyticsController.prototype.content],
    ['engagement', AdminAnalyticsController.prototype.engagement],
    ['moderation', AdminAnalyticsController.prototype.moderation],
    ['system', AdminAnalyticsController.prototype.system],
    ['export', AdminAnalyticsController.prototype.export],
  ];

  it.each(routes)('%s requires analytics.view', (_name, handler) => {
    expect(permsOf(handler)).toEqual([PERMISSIONS.AnalyticsView]);
  });
});

describe('AdminAnalyticsController — export', () => {
  const user = { id: 'admin-1', role: 'admin' } as AuthenticatedUser;
  const req = { headers: { 'x-request-id': 'req-1' }, ip: '127.0.0.1' } as unknown as Request;

  function makeRes() {
    const chunks: string[] = [];
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      write: (c: string) => {
        chunks.push(c);
        return true;
      },
      end: jest.fn(),
    } as unknown as Response;
    return { res, chunks, headers };
  }

  function makeController(data: unknown) {
    const analytics = {
      getExportData: jest.fn().mockResolvedValue(data),
    } as unknown as AnalyticsService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    return { controller: new AdminAnalyticsController(analytics, audit), audit };
  }

  it('streams CSV metric rows and audits the export', async () => {
    const { controller, audit } = makeController({ totalUsers: 50, growthRatePct: 12.5 });
    const { res, chunks, headers } = makeRes();
    const query = Object.assign(new AdminAnalyticsExportQueryDto(), {
      dataset: 'overview',
      format: 'csv' as const,
    });

    await controller.export(query, user, req, res);

    expect(headers['Content-Type']).toContain('text/csv');
    const body = chunks.join('');
    expect(body).toContain('metric,value');
    expect(body).toContain('totalUsers,50');
    expect(body).toContain('growthRatePct,12.5');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'analytics.export',
        metadata: { dataset: 'overview', format: 'csv' },
      }),
    );
    expect(res.end).toHaveBeenCalled();
  });

  it('streams JSON when format=json', async () => {
    const { controller } = makeController({ totalUsers: 7 });
    const { res, chunks, headers } = makeRes();
    const query = Object.assign(new AdminAnalyticsExportQueryDto(), {
      dataset: 'overview',
      format: 'json' as const,
    });

    await controller.export(query, user, req, res);

    expect(headers['Content-Type']).toContain('application/json');
    expect(JSON.parse(chunks.join(''))).toEqual({ totalUsers: 7 });
  });

  it('flattens nested arrays into indexed CSV rows', async () => {
    const { controller } = makeController({ queues: [{ name: 'q1', waiting: 3 }] });
    const { res, chunks } = makeRes();
    const query = Object.assign(new AdminAnalyticsExportQueryDto(), {
      dataset: 'system',
      format: 'csv' as const,
    });

    await controller.export(query, user, req, res);
    const body = chunks.join('');
    expect(body).toContain('queues[0].name,q1');
    expect(body).toContain('queues[0].waiting,3');
  });
});
