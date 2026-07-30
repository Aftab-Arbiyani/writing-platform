import { ReportEntityType, ReportPriority, ReportReason, ReportStatus, Role } from '@qalam/shared';

import type { AuditService } from '../audit/audit.service';
import type { AuthService } from '../auth/auth.service';
import type { CommentsService } from '../engagement/comments.service';
import type { PiecesService } from '../pieces/pieces.service';
import type { UsersService } from '../users/users.service';
import type { Report } from './entities/report.entity';
import type { ReportNote } from './entities/report-note.entity';
import { ModerationRepository } from './moderation.repository';
import { ModerationService, type ModerationActor } from './moderation.service';

const actor: ModerationActor = { id: 'mod1', role: Role.Admin };

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

function note(overrides: Partial<ReportNote> = {}): ReportNote {
  return {
    id: 'n1',
    reportId: 'r1',
    authorId: 'mod1',
    body: 'old body',
    createdAt: new Date('2026-07-10T01:00:00.000Z'),
    updatedAt: new Date('2026-07-10T01:00:00.000Z'),
    ...overrides,
  } as ReportNote;
}

function makeService(repo: Partial<ModerationRepository> = {}) {
  const repository = {
    findReportById: jest.fn().mockResolvedValue(report()),
    saveReport: jest.fn((r: Report) => Promise.resolve(r)),
    findNote: jest.fn().mockResolvedValue(note()),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
    listNotes: jest.fn().mockResolvedValue([]),
    findAppealByReport: jest.fn().mockResolvedValue(null),
    countByStatus: jest.fn().mockResolvedValue({}),
    countByReason: jest.fn().mockResolvedValue({}),
    countBySeverity: jest.fn().mockResolvedValue({}),
    avgResolutionSeconds: jest.fn().mockResolvedValue(null),
    moderatorPerformance: jest.fn().mockResolvedValue([]),
    trends: jest.fn().mockResolvedValue([]),
    ...repo,
  };
  const audit = { record: jest.fn(), recentForTarget: jest.fn().mockResolvedValue([]) };
  const service = new ModerationService(
    repository as unknown as ModerationRepository,
    audit as unknown as AuditService,
    {} as unknown as PiecesService,
    {} as unknown as CommentsService,
    {} as unknown as UsersService,
    {} as unknown as AuthService,
  );
  return { service, repository, audit };
}

describe('ModerationService.getStatistics', () => {
  it('aggregates open/resolved/dismissed + passes through breakdowns', async () => {
    const { service } = makeService({
      countByStatus: jest.fn().mockResolvedValue({
        pending: 3,
        reviewing: 2,
        appealed: 1,
        resolved: 10,
        dismissed: 4,
      }),
      avgResolutionSeconds: jest.fn().mockResolvedValue(3600),
      moderatorPerformance: jest
        .fn()
        .mockResolvedValue([{ moderatorId: 'm', resolved: 10, avgSeconds: 3600 }]),
    });
    const stats = await service.getStatistics();
    expect(stats.openReports).toBe(6); // 3 + 2 + 1
    expect(stats.resolvedReports).toBe(10);
    expect(stats.dismissedReports).toBe(4);
    expect(stats.avgResolutionSeconds).toBe(3600);
    expect(stats.moderatorPerformance).toHaveLength(1);
  });
});

describe('ModerationService.reopenReport', () => {
  it('reopens a resolved report and clears the resolution', async () => {
    const { service, repository } = makeService({
      findReportById: jest.fn().mockResolvedValue(
        report({
          status: ReportStatus.Resolved,
          resolution: 'content_hidden' as Report['resolution'],
          resolvedById: 'x',
        }),
      ),
    });
    const result = await service.reopenReport('r1', actor);
    expect(result.status).toBe(ReportStatus.Reviewing);
    expect(repository.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReportStatus.Reviewing,
        resolution: null,
        resolvedById: null,
      }),
    );
  });

  it('rejects reopening a non-terminal report', async () => {
    const { service } = makeService();
    await expect(service.reopenReport('r1', actor)).rejects.toMatchObject({
      code: 'REPORT_INVALID_RESOLUTION',
    });
  });
});

describe('ModerationService notes (edit/delete)', () => {
  it('updates a note that belongs to the report', async () => {
    const { service, repository } = makeService();
    const result = await service.updateNote('r1', 'n1', 'new body', actor);
    expect(repository.updateNote).toHaveBeenCalledWith('n1', 'new body');
    expect(result.body).toBe('new body');
  });

  it('rejects editing a note from another report', async () => {
    const { service } = makeService({
      findNote: jest.fn().mockResolvedValue(note({ reportId: 'other' })),
    });
    await expect(service.updateNote('r1', 'n1', 'x', actor)).rejects.toMatchObject({
      code: 'REPORT_NOT_FOUND',
    });
  });

  it('deletes a note', async () => {
    const { service, repository } = makeService();
    await service.deleteNote('r1', 'n1', actor);
    expect(repository.deleteNote).toHaveBeenCalledWith('n1');
  });
});

describe('ModerationService.getTimeline', () => {
  it('merges audit actions + notes, newest first', async () => {
    const { service, audit } = makeService({
      listNotes: jest
        .fn()
        .mockResolvedValue([note({ createdAt: new Date('2026-07-10T05:00:00.000Z') })]),
    });
    (audit.recentForTarget as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        action: 'report.resolve',
        category: 'administrative',
        actorId: 'mod1',
        actorRole: 'admin',
        targetId: 'r1',
        targetType: 'report',
        metadata: {},
        ip: null,
        requestId: null,
        createdAt: '2026-07-10T06:00:00.000Z',
      },
    ]);
    const timeline = await service.getTimeline('r1');
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.kind).toBe('action'); // 06:00 newest
    expect(timeline[1]?.kind).toBe('note'); // 05:00
  });
});

describe('ModerationService.getTrends', () => {
  it('returns the window + points from the repository', async () => {
    const { service } = makeService({
      trends: jest.fn().mockResolvedValue([{ date: '2026-07-10', created: 4, resolved: 2 }]),
    });
    const result = await service.getTrends('2026-07-01', '2026-07-31');
    expect(result.from).toBe('2026-07-01');
    expect(result.points).toEqual([{ date: '2026-07-10', created: 4, resolved: 2 }]);
  });
});
