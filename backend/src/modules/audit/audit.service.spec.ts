import { AUDIT_ACTIONS, AUDIT_TARGET } from './audit.constants';
import type { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import type { AuditLog } from './entities/audit-log.entity';

function auditRow(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'a1',
    actorId: 'admin1',
    actorRole: 'admin',
    action: AUDIT_ACTIONS.UserSuspend,
    targetType: AUDIT_TARGET.User,
    targetId: 'user1',
    metadata: {},
    ip: '127.0.0.1',
    userAgent: 'jest',
    requestId: 'req1',
    createdAt: new Date('2026-07-10T09:00:00.000Z'),
    ...overrides,
  } as AuditLog;
}

function serviceWith(repo: Partial<AuditRepository>): {
  service: AuditService;
  repo: jest.Mocked<AuditRepository>;
} {
  const mock = {
    record: jest.fn(),
    listForTarget: jest.fn(),
    tallyByAction: jest.fn(),
    recentForTarget: jest.fn(),
    ...repo,
  } as unknown as jest.Mocked<AuditRepository>;
  return { service: new AuditService(mock), repo: mock };
}

describe('AuditService.record', () => {
  it('persists an entry, defaulting target type/metadata and resolving context', async () => {
    const { service, repo } = serviceWith({ record: jest.fn().mockResolvedValue(auditRow()) });
    await service.record({
      actorId: 'admin1',
      actorRole: 'admin',
      action: AUDIT_ACTIONS.UserVerify,
      targetId: 'user1',
      context: { ip: '10.0.0.1', userAgent: 'ua', requestId: 'r1' },
    });
    expect(repo.record).toHaveBeenCalledWith({
      actorId: 'admin1',
      actorRole: 'admin',
      action: AUDIT_ACTIONS.UserVerify,
      targetType: AUDIT_TARGET.User,
      targetId: 'user1',
      metadata: {},
      ip: '10.0.0.1',
      userAgent: 'ua',
      requestId: 'r1',
    });
  });

  it('nulls out missing context fields', async () => {
    const { service, repo } = serviceWith({ record: jest.fn().mockResolvedValue(auditRow()) });
    await service.record({
      actorId: 'a',
      actorRole: 'admin',
      action: AUDIT_ACTIONS.UserForceLogout,
      targetId: 'u',
    });
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({ ip: null, userAgent: null, requestId: null }),
    );
  });
});

describe('AuditService.listForUser', () => {
  it('maps rows to DTOs (with category) and builds offset meta', async () => {
    const { service } = serviceWith({
      listForTarget: jest.fn().mockResolvedValue([[auditRow()], 1]),
    });
    const page = await service.listForUser('user1', {
      actions: [AUDIT_ACTIONS.UserSuspend],
      page: 1,
      limit: 20,
      offset: 0,
    });
    expect(page.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(page.items[0]).toMatchObject({ action: AUDIT_ACTIONS.UserSuspend, category: 'status' });
  });
});

describe('AuditService.summaryForUser', () => {
  it('aggregates counts by action and by category and reports the last action time', async () => {
    const { service } = serviceWith({
      tallyByAction: jest.fn().mockResolvedValue([
        { action: AUDIT_ACTIONS.UserSuspend, count: 2 },
        { action: AUDIT_ACTIONS.UserUpdate, count: 1 },
      ]),
      recentForTarget: jest
        .fn()
        .mockResolvedValue([auditRow({ createdAt: new Date('2026-07-10T09:00:00.000Z') })]),
    });
    const summary = await service.summaryForUser('user1');
    expect(summary.totalEvents).toBe(3);
    expect(summary.byAction).toEqual({ 'user.suspend': 2, 'user.update': 1 });
    expect(summary.byCategory).toEqual({ status: 2, administrative: 1 });
    expect(summary.lastActionAt).toBe('2026-07-10T09:00:00.000Z');
  });

  it('reports zero/null for a user with no trail', async () => {
    const { service } = serviceWith({
      tallyByAction: jest.fn().mockResolvedValue([]),
      recentForTarget: jest.fn().mockResolvedValue([]),
    });
    const summary = await service.summaryForUser('user1');
    expect(summary.totalEvents).toBe(0);
    expect(summary.lastActionAt).toBeNull();
  });
});
