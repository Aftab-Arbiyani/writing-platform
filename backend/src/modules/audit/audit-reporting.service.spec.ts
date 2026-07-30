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
    adminList: jest.fn(),
    findById: jest.fn(),
    countSince: jest.fn(),
    topActions: jest.fn(),
    topActors: jest.fn(),
    stream: jest.fn(),
    ...repo,
  } as unknown as jest.Mocked<AuditRepository>;
  return { service: new AuditService(mock), repo: mock };
}

describe('AuditService.adminList', () => {
  it('maps rows to DTOs and builds offset meta', async () => {
    const { service } = serviceWith({ adminList: jest.fn().mockResolvedValue([[auditRow()], 1]) });
    const page = await service.adminList({ offset: 0, limit: 20 }, 1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.action).toBe(AUDIT_ACTIONS.UserSuspend);
    expect(page.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });
});

describe('AuditService.getById', () => {
  it('returns the entry when found', async () => {
    const { service } = serviceWith({ findById: jest.fn().mockResolvedValue(auditRow()) });
    const entry = await service.getById('a1');
    expect(entry?.id).toBe('a1');
  });

  it('returns null when absent', async () => {
    const { service } = serviceWith({ findById: jest.fn().mockResolvedValue(null) });
    expect(await service.getById('missing')).toBeNull();
  });
});

describe('AuditService.statistics', () => {
  it('reports per-window counts + top actions/actors', async () => {
    const { service } = serviceWith({
      countSince: jest
        .fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20),
      topActions: jest.fn().mockResolvedValue([{ action: 'user.suspend', count: 7 }]),
      topActors: jest.fn().mockResolvedValue([{ actorId: 'admin1', count: 4 }]),
    });
    const stats = await service.statistics();
    expect(stats.today).toBe(2);
    expect(stats.thisWeek).toBe(5);
    expect(stats.thisMonth).toBe(20);
    expect(stats.topActions).toEqual([{ action: 'user.suspend', count: 7 }]);
    expect(stats.mostActiveActors).toEqual([{ actorId: 'admin1', count: 4 }]);
  });
});
