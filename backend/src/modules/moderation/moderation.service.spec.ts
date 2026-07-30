import {
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportResolution,
  ReportStatus,
  Role,
  UserStatus,
} from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { AuthService } from '../auth/auth.service';
import type { CommentsService } from '../engagement/comments.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { UsersService } from '../users/users.service';
import type { Report } from './entities/report.entity';
import { ModerationRepository } from './moderation.repository';
import { ModerationService, type ModerationActor } from './moderation.service';

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'r1',
    reporterId: 'reporter1',
    entityType: ReportEntityType.Piece,
    entityId: 'piece1',
    reportedUserId: 'author1',
    reason: ReportReason.Spam,
    description: null,
    status: ReportStatus.Pending,
    priority: ReportPriority.Normal,
    severity: null,
    assignedModeratorId: null,
    resolution: null,
    resolutionReason: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    ...overrides,
  } as Report;
}

const admin: ModerationActor = { id: 'admin1', role: Role.Admin };
const moderator: ModerationActor = { id: 'mod1', role: Role.Moderator };

function makeService(
  over: {
    repo?: Partial<ModerationRepository>;
    audit?: Partial<AuditService>;
    pieces?: Partial<PiecesService>;
    comments?: Partial<CommentsService>;
    users?: Partial<UsersService>;
    auth?: Partial<AuthService>;
  } = {},
) {
  const repo = {
    createReport: jest.fn((input) => Promise.resolve(report(input))),
    findReportById: jest.fn().mockResolvedValue(report()),
    findReportsByIds: jest.fn().mockResolvedValue([]),
    findOpenReport: jest.fn().mockResolvedValue(null),
    saveReport: jest.fn((r: Report) => Promise.resolve(r)),
    addNote: jest.fn(),
    listNotes: jest.fn().mockResolvedValue([]),
    findAppealByReport: jest.fn().mockResolvedValue(null),
    createWarning: jest.fn((input) =>
      Promise.resolve({ id: 'w1', createdAt: new Date('2026-07-10T00:00:00.000Z'), ...input }),
    ),
    listWarnings: jest.fn().mockResolvedValue([]),
    ...over.repo,
  };
  const audit = {
    record: jest.fn(),
    recentForTarget: jest.fn().mockResolvedValue([]),
    ...over.audit,
  };
  const pieces = {
    findAuthorId: jest.fn().mockResolvedValue('author1'),
    moderateHide: jest.fn(),
    moderateRestore: jest.fn(),
    moderateRemove: jest.fn(),
    ...over.pieces,
  };
  const comments = {
    findAuthorId: jest.fn().mockResolvedValue('author1'),
    delete: jest.fn(),
    moderateRestore: jest.fn(),
    ...over.comments,
  };
  const users = {
    findById: jest.fn().mockResolvedValue({ id: 'author1', status: UserStatus.Active }),
    setStatus: jest.fn(),
    ...over.users,
  };
  const auth = { logoutAll: jest.fn(), ...over.auth };
  const service = new ModerationService(
    repo as unknown as ModerationRepository,
    audit as unknown as AuditService,
    pieces as unknown as PiecesService,
    comments as unknown as CommentsService,
    users as unknown as UsersService,
    auth as unknown as AuthService,
  );
  return { service, repo, audit, pieces, comments, users, auth };
}

describe('ModerationService.createReport', () => {
  it('creates a report and resolves the offending user', async () => {
    const { service, repo } = makeService();
    const result = await service.createReport('reporter1', {
      entityType: ReportEntityType.Piece,
      entityId: 'piece1',
      reason: ReportReason.Spam,
    });
    expect(repo.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ reportedUserId: 'author1', reporterId: 'reporter1' }),
    );
    expect(result.status).toBe(ReportStatus.Pending);
  });

  it('rejects reporting your own content (REPORT_SELF)', async () => {
    const { service } = makeService({
      pieces: { findAuthorId: jest.fn().mockResolvedValue('reporter1') },
    });
    await expect(
      service.createReport('reporter1', {
        entityType: ReportEntityType.Piece,
        entityId: 'piece1',
        reason: ReportReason.Spam,
      }),
    ).rejects.toMatchObject({ code: 'REPORT_SELF' });
  });

  it('rejects a duplicate open report (REPORT_DUPLICATE)', async () => {
    const { service } = makeService({
      repo: { findOpenReport: jest.fn().mockResolvedValue(report()) },
    });
    await expect(
      service.createReport('reporter1', {
        entityType: ReportEntityType.Piece,
        entityId: 'piece1',
        reason: ReportReason.Spam,
      }),
    ).rejects.toMatchObject({ code: 'REPORT_DUPLICATE' });
  });

  it('rejects a missing target (REPORT_TARGET_NOT_FOUND)', async () => {
    const { service } = makeService({
      pieces: { findAuthorId: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.createReport('reporter1', {
        entityType: ReportEntityType.Piece,
        entityId: 'gone',
        reason: ReportReason.Spam,
      }),
    ).rejects.toMatchObject({ code: 'REPORT_TARGET_NOT_FOUND' });
  });
});

describe('ModerationService.resolve', () => {
  it('hides the reported piece and marks the report resolved', async () => {
    const { service, pieces, repo, audit } = makeService();
    const result = await service.resolve(
      'r1',
      { resolution: ReportResolution.ContentHidden },
      moderator,
    );
    expect(pieces.moderateHide).toHaveBeenCalledWith('piece1');
    expect(repo.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReportStatus.Resolved,
        resolution: ReportResolution.ContentHidden,
      }),
    );
    expect(audit.record).toHaveBeenCalled();
    expect(result.resolution).toBe(ReportResolution.ContentHidden);
  });

  it('soft-deletes a reported comment on content removal', async () => {
    const { service, comments } = makeService({
      repo: {
        findReportById: jest
          .fn()
          .mockResolvedValue(report({ entityType: ReportEntityType.Comment, entityId: 'c1' })),
      },
    });
    await service.resolve('r1', { resolution: ReportResolution.ContentRemoved }, moderator);
    expect(comments.delete).toHaveBeenCalledWith('c1', 'mod1', Role.Moderator);
  });

  it('forbids a moderator from suspending via resolution (admin only)', async () => {
    const { service } = makeService();
    await expect(
      service.resolve('r1', { resolution: ReportResolution.UserSuspended }, moderator),
    ).rejects.toMatchObject({ code: 'AUTH_PERMISSION_DENIED' });
  });

  it('lets an admin suspend the offender and revokes their sessions', async () => {
    const { service, users, auth } = makeService();
    await service.resolve('r1', { resolution: ReportResolution.UserSuspended }, admin);
    expect(users.setStatus).toHaveBeenCalledWith('author1', UserStatus.Suspended);
    expect(auth.logoutAll).toHaveBeenCalledWith('author1', expect.anything());
  });

  it('rejects resolving an already-resolved report', async () => {
    const { service } = makeService({
      repo: {
        findReportById: jest.fn().mockResolvedValue(report({ status: ReportStatus.Resolved })),
      },
    });
    await expect(
      service.resolve('r1', { resolution: ReportResolution.Dismissed }, moderator),
    ).rejects.toMatchObject({ code: 'REPORT_ALREADY_RESOLVED' });
  });
});

describe('ModerationService.warnUser + bulk', () => {
  it('records a warning', async () => {
    const { service, repo, audit } = makeService();
    const warning = await service.warnUser('author1', { reason: 'Be nice' }, moderator);
    expect(repo.createWarning).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'author1', moderatorId: 'mod1', reason: 'Be nice' }),
    );
    expect(audit.record).toHaveBeenCalled();
    expect(warning.reason).toBe('Be nice');
  });

  it('reports per-id success/failure for a bulk reject', async () => {
    const { service } = makeService({
      repo: {
        findReportsByIds: jest.fn().mockResolvedValue([report({ id: 'r1' })]),
        findReportById: jest.fn().mockResolvedValue(report({ id: 'r1' })),
        saveReport: jest.fn((r: Report) => Promise.resolve(r)),
      },
    });
    const result = await service.bulk(
      { action: 'reject', reportIds: ['r1', 'missing'] },
      moderator,
    );
    expect(result.succeeded).toEqual(['r1']);
    expect(result.failed).toEqual([{ id: 'missing', message: 'Report not found.' }]);
  });
});
