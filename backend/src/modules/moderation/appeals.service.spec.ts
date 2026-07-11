import {
  AppealStatus,
  ReportEntityType,
  ReportResolution,
  ReportStatus,
  Role,
  UserStatus,
} from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { CommentsService } from '../engagement/comments.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { UsersService } from '../users/users.service';
import { AppealsService } from './appeals.service';
import type { Appeal } from './entities/appeal.entity';
import type { Report } from './entities/report.entity';
import { ModerationRepository } from './moderation.repository';
import type { ModerationActor } from './moderation.service';

const admin: ModerationActor = { id: 'admin1', role: Role.Admin };

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'r1',
    reporterId: 'reporter1',
    entityType: ReportEntityType.Piece,
    entityId: 'piece1',
    reportedUserId: 'author1',
    reason: 'spam',
    description: null,
    status: ReportStatus.Resolved,
    priority: 'normal',
    severity: null,
    assignedModeratorId: null,
    resolution: ReportResolution.ContentHidden,
    resolutionReason: null,
    resolvedById: 'mod1',
    resolvedAt: new Date('2026-07-10T00:00:00.000Z'),
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    ...overrides,
  } as Report;
}

function appeal(overrides: Partial<Appeal> = {}): Appeal {
  return {
    id: 'a1',
    reportId: 'r1',
    appellantId: 'author1',
    reason: 'It was fair use',
    status: AppealStatus.Pending,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    ...overrides,
  } as Appeal;
}

function makeService(
  over: {
    repo?: Partial<ModerationRepository>;
    pieces?: Partial<PiecesService>;
    users?: Partial<UsersService>;
  } = {},
) {
  const repo = {
    findReportById: jest.fn().mockResolvedValue(report()),
    findAppealById: jest.fn().mockResolvedValue(appeal()),
    findAppealByReport: jest.fn().mockResolvedValue(null),
    createAppeal: jest.fn((reportId, appellantId, reason) =>
      Promise.resolve(appeal({ reportId, appellantId, reason })),
    ),
    saveAppeal: jest.fn((a: Appeal) => Promise.resolve(a)),
    saveReport: jest.fn((r: Report) => Promise.resolve(r)),
    listAppeals: jest.fn(),
    ...over.repo,
  };
  const audit = { record: jest.fn(), recentForTarget: jest.fn().mockResolvedValue([]) };
  const pieces = { moderateRestore: jest.fn(), ...over.pieces };
  const comments = { moderateRestore: jest.fn() };
  const users = {
    findById: jest.fn().mockResolvedValue({ id: 'author1', status: UserStatus.Suspended }),
    setStatus: jest.fn(),
    ...over.users,
  };
  const service = new AppealsService(
    repo as unknown as ModerationRepository,
    audit as unknown as AuditService,
    pieces as unknown as PiecesService,
    comments as unknown as CommentsService,
    users as unknown as UsersService,
  );
  return { service, repo, audit, pieces, users };
}

describe('AppealsService.createAppeal', () => {
  it('files an appeal and marks the report appealed', async () => {
    const { service, repo } = makeService();
    const result = await service.createAppeal('r1', 'author1', { reason: 'Please reconsider' });
    expect(repo.createAppeal).toHaveBeenCalledWith('r1', 'author1', 'Please reconsider');
    expect(repo.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({ status: ReportStatus.Appealed }),
    );
    expect(result.status).toBe(AppealStatus.Pending);
  });

  it('rejects an appeal on a non-punitive report (APPEAL_NOT_ALLOWED)', async () => {
    const { service } = makeService({
      repo: {
        findReportById: jest
          .fn()
          .mockResolvedValue(report({ resolution: ReportResolution.Dismissed })),
      },
    });
    await expect(
      service.createAppeal('r1', 'author1', { reason: 'x'.repeat(20) }),
    ).rejects.toMatchObject({ code: 'APPEAL_NOT_ALLOWED' });
  });

  it('rejects an appeal from anyone but the subject', async () => {
    const { service } = makeService();
    await expect(
      service.createAppeal('r1', 'someone-else', { reason: 'x'.repeat(20) }),
    ).rejects.toMatchObject({ code: 'APPEAL_NOT_ALLOWED' });
  });

  it('rejects a second appeal (APPEAL_ALREADY_EXISTS)', async () => {
    const { service } = makeService({
      repo: { findAppealByReport: jest.fn().mockResolvedValue(appeal()) },
    });
    await expect(
      service.createAppeal('r1', 'author1', { reason: 'x'.repeat(20) }),
    ).rejects.toMatchObject({ code: 'APPEAL_ALREADY_EXISTS' });
  });
});

describe('AppealsService.approve / reject', () => {
  it('approve restores hidden content and resolves the report', async () => {
    const { service, pieces, repo } = makeService();
    const result = await service.approve('a1', { notes: 'valid' }, admin);
    expect(pieces.moderateRestore).toHaveBeenCalledWith('piece1');
    expect(repo.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({ status: ReportStatus.Resolved }),
    );
    expect(result.status).toBe(AppealStatus.Approved);
  });

  it('approve reactivates a suspended offender', async () => {
    const { service, users } = makeService({
      repo: {
        findReportById: jest
          .fn()
          .mockResolvedValue(report({ resolution: ReportResolution.UserSuspended })),
        findAppealById: jest.fn().mockResolvedValue(appeal()),
        saveAppeal: jest.fn((a: Appeal) => Promise.resolve(a)),
        saveReport: jest.fn((r: Report) => Promise.resolve(r)),
      },
    });
    await service.approve('a1', {}, admin);
    expect(users.setStatus).toHaveBeenCalledWith('author1', UserStatus.Active);
  });

  it('rejects reviewing an already-reviewed appeal', async () => {
    const { service } = makeService({
      repo: {
        findAppealById: jest.fn().mockResolvedValue(appeal({ status: AppealStatus.Rejected })),
      },
    });
    await expect(service.approve('a1', {}, admin)).rejects.toMatchObject({
      code: 'APPEAL_ALREADY_REVIEWED',
    });
  });

  it('reject records the rejection', async () => {
    const { service, repo } = makeService();
    const result = await service.reject('a1', { notes: 'no' }, admin);
    expect(result.status).toBe(AppealStatus.Rejected);
    expect(repo.saveAppeal).toHaveBeenCalledWith(
      expect.objectContaining({ status: AppealStatus.Rejected, reviewNotes: 'no' }),
    );
  });
});
