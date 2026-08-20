import { PERMISSIONS, Role, UserStatus } from '@qalam/shared';

import { PERMISSIONS_KEY } from '../../common/constants/metadata.constants';
import type { AnalyticsService } from '../analytics/analytics.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import type { AuditService } from '../audit/audit.service';
import type { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PiecesService } from '../pieces/pieces.service';
import type { ProfileService } from '../users/profile.service';
import type { RolesService } from '../users/roles.service';
import type { AdminUserRow } from '../users/users.repository';
import type { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminSelfActionException } from './admin.exceptions';
import { EXPORT_COLUMNS } from './admin-user.mapper';

const ADMIN: AuthenticatedUser = { id: 'admin1', role: Role.Admin, sessionVersion: 1 };
const TARGET = 'user1';

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: TARGET,
    email: 'meera@example.com',
    username: 'meera_k',
    status: UserStatus.Active,
    emailVerifiedAt: new Date('2026-02-01T00:00:00.000Z'),
    lastLoginAt: new Date('2026-07-09T18:30:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: null,
    penName: 'Meera',
    avatarKey: null,
    isPrivate: false,
    followersCount: 12,
    followingCount: 4,
    piecesCount: 7,
    role: Role.User,
    ...overrides,
  };
}

const WRITER = {
  totalViews: 100,
  uniqueViews: 80,
  reads: 40,
  completionRate: 0.4,
  totalReadSeconds: 0,
  averageReadTimeSeconds: 0,
  followersGained: 0,
  piecesPublished: 7,
  piecesArchived: 0,
  commentsReceived: 5,
  clapsReceived: 9,
  bookmarksReceived: 3,
  responsesReceived: 1,
  mostPopularPiece: null,
};

interface Mocks {
  users: jest.Mocked<UsersService>;
  profiles: jest.Mocked<ProfileService>;
  roles: jest.Mocked<RolesService>;
  pieces: jest.Mocked<PiecesService>;
  auth: jest.Mocked<AuthService>;
  analytics: jest.Mocked<AnalyticsService>;
  audit: jest.Mocked<AuditService>;
}

function build(): { controller: AdminUsersController; mocks: Mocks } {
  const mocks: Mocks = {
    users: {
      adminList: jest.fn(),
      adminGetRow: jest.fn().mockResolvedValue(row()),
      adminGetAccount: jest.fn().mockResolvedValue({ status: UserStatus.Active, email: 'm@x.com' }),
      adminFindRowsByIds: jest.fn(),
      adminStream: jest.fn(),
      setStatus: jest.fn(),
      setEmailVerified: jest.fn(),
    } as unknown as jest.Mocked<UsersService>,
    profiles: {
      getOrCreateByUserId: jest.fn().mockResolvedValue({
        penName: 'Meera',
        bio: null,
        avatarKey: null,
        coverKey: null,
        websiteUrl: null,
        location: null,
        socialLinks: {},
      }),
      adminUpdatePenName: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProfileService>,
    roles: {
      getEffectiveRole: jest.fn().mockResolvedValue(Role.User),
      setRole: jest.fn().mockResolvedValue({ before: Role.User, after: Role.Admin }),
    } as unknown as jest.Mocked<RolesService>,
    pieces: {
      countDraftsByAuthors: jest.fn().mockResolvedValue({}),
      countByAuthor: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<PiecesService>,
    auth: {
      logoutAll: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>,
    analytics: {
      getWriterAnalytics: jest.fn().mockResolvedValue(WRITER),
    } as unknown as jest.Mocked<AnalyticsService>,
    audit: {
      record: jest.fn().mockResolvedValue(undefined),
      summaryForUser: jest.fn().mockResolvedValue({
        totalEvents: 1,
        byAction: {},
        byCategory: { status: 1 },
        lastActionAt: null,
      }),
      recentForUser: jest.fn().mockResolvedValue([]),
      listForUser: jest.fn(),
    } as unknown as jest.Mocked<AuditService>,
  };
  const controller = new AdminUsersController(
    mocks.users,
    mocks.profiles,
    mocks.roles,
    mocks.pieces,
    mocks.auth,
    mocks.analytics,
    mocks.audit,
  );
  return { controller, mocks };
}

function fakeReq(): unknown {
  return {
    ip: '127.0.0.1',
    header: (name: string): string | undefined =>
      name.toLowerCase() === 'user-agent'
        ? 'jest'
        : name.toLowerCase() === 'x-request-id'
          ? 'req1'
          : undefined,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const req = (): any => fakeReq();

describe('AdminUsersController — authorization metadata', () => {
  const proto = AdminUsersController.prototype;
  const perms = (fn: unknown): string[] | undefined =>
    Reflect.getMetadata(PERMISSIONS_KEY, fn as object);

  it.each([
    ['list', proto.list, PERMISSIONS.UserView],
    ['detail', proto.detail, PERMISSIONS.UserView],
    ['statistics', proto.statistics, PERMISSIONS.UserView],
    ['export', proto.export, PERMISSIONS.UserView],
    ['update', proto.update, PERMISSIONS.UserUpdate],
    ['verify', proto.verify, PERMISSIONS.UserUpdate],
    ['resetPassword', proto.resetPassword, PERMISSIONS.UserUpdate],
    ['suspend', proto.suspend, PERMISSIONS.UserSuspend],
    ['deactivate', proto.deactivate, PERMISSIONS.UserSuspend],
    ['forceLogout', proto.forceLogout, PERMISSIONS.UserSuspend],
    ['bulk', proto.bulk, PERMISSIONS.UserSuspend],
    ['unsuspend', proto.unsuspend, PERMISSIONS.UserRestore],
    ['reactivate', proto.reactivate, PERMISSIONS.UserRestore],
  ])('gates %s with %s', (_name, fn, expected) => {
    expect(perms(fn)).toEqual([expected]);
  });
});

describe('AdminUsersController.list', () => {
  it('maps rows, folds in batched draft counts, and returns offset pagination meta', async () => {
    const { controller, mocks } = build();
    mocks.users.adminList.mockResolvedValue({
      items: [row()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    mocks.pieces.countDraftsByAuthors.mockResolvedValue({ [TARGET]: 3 });

    const result = await controller.list({ page: 1, limit: 20, offset: 0 } as any);

    expect(result.success).toBe(true);
    expect(result.data[0]).toMatchObject({ username: 'meera_k', draftCount: 3 });
    expect(result.meta.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('passes typed filters (status) through to the service', async () => {
    const { controller, mocks } = build();
    mocks.users.adminList.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    await controller.list({ page: 1, limit: 20, offset: 0, status: UserStatus.Suspended } as any);
    expect(mocks.users.adminList).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.Suspended }),
    );
  });

  it('applies ?fields column selection', async () => {
    const { controller, mocks } = build();
    mocks.users.adminList.mockResolvedValue({
      items: [row()],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const result = await controller.list({
      page: 1,
      limit: 20,
      offset: 0,
      fields: 'username,email',
    } as any);
    expect(Object.keys(result.data[0] ?? {}).sort()).toEqual(['email', 'id', 'username']);
  });
});

describe('AdminUsersController.detail / statistics', () => {
  it('assembles detail from every contributing service', async () => {
    const { controller, mocks } = build();
    mocks.pieces.countByAuthor.mockResolvedValue(2);
    const detail = await controller.detail(TARGET);
    expect(detail.statistics.drafts).toBe(2);
    expect(detail.statistics.views).toBe(100);
    expect(detail.moderation.statusChanges).toBe(1);
    expect(detail.moderation.reports).toBe(0);
    expect(detail.profile.penName).toBe('Meera');
    expect(mocks.analytics.getWriterAnalytics).toHaveBeenCalledWith(TARGET);
  });

  it('maps the statistics view', async () => {
    const { controller } = build();
    const stats = await controller.statistics(TARGET);
    expect(stats).toMatchObject({
      views: 100,
      reads: 40,
      followers: 12,
      following: 4,
      publishedPieces: 7,
      drafts: 2,
      claps: 9,
    });
  });
});

describe('AdminUsersController.update', () => {
  it('blocks an admin from changing their own role', async () => {
    const { controller, mocks } = build();
    mocks.roles.getEffectiveRole.mockResolvedValue(Role.User);
    await expect(
      controller.update(ADMIN.id, { role: Role.Admin }, ADMIN, req()),
    ).rejects.toBeInstanceOf(AdminSelfActionException);
  });

  it('applies each provided field and records a user.update audit entry', async () => {
    const { controller, mocks } = build();
    mocks.users.setStatus.mockResolvedValue({
      before: UserStatus.Active,
      after: UserStatus.Suspended,
    });
    mocks.users.setEmailVerified.mockResolvedValue({ before: false, after: true });

    await controller.update(
      TARGET,
      { displayName: 'New Name', status: UserStatus.Suspended, verified: true },
      ADMIN,
      req(),
    );

    expect(mocks.profiles.adminUpdatePenName).toHaveBeenCalledWith(TARGET, 'New Name');
    expect(mocks.users.setStatus).toHaveBeenCalledWith(TARGET, UserStatus.Suspended);
    expect(mocks.users.setEmailVerified).toHaveBeenCalledWith(TARGET, true);
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserUpdate, targetId: TARGET }),
    );
  });
});

describe('AdminUsersController account actions', () => {
  it('verify → sets verified and audits', async () => {
    const { controller, mocks } = build();
    mocks.users.setEmailVerified.mockResolvedValue({ before: false, after: true });
    const result = await controller.verify(TARGET, ADMIN, req(), {});
    expect(result.after).toBe('true');
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserVerify }),
    );
  });

  it('suspend → blocks self-target', async () => {
    const { controller } = build();
    await expect(controller.suspend(ADMIN.id, ADMIN, req(), {})).rejects.toBeInstanceOf(
      AdminSelfActionException,
    );
  });

  it('suspend → sets status, revokes sessions, and audits', async () => {
    const { controller, mocks } = build();
    mocks.users.setStatus.mockResolvedValue({
      before: UserStatus.Active,
      after: UserStatus.Suspended,
    });
    const result = await controller.suspend(TARGET, ADMIN, req(), { reason: 'spam' });
    // `allowNoop` is asserted, not incidental: it is what makes the endpoint retryable (B9-1), and a
    // future refactor dropping it would restore an unrecoverable failure with every test still green.
    expect(mocks.users.setStatus).toHaveBeenCalledWith(TARGET, UserStatus.Suspended, {
      allowNoop: true,
    });
    expect(mocks.auth.logoutAll).toHaveBeenCalledWith(
      TARGET,
      expect.objectContaining({ ip: '127.0.0.1' }),
    );
    expect(result.after).toBe(UserStatus.Suspended);
  });

  /*
   * **B9-1** (docs/48 §3.17) — the retry, which is the whole point of the fix.
   *
   * The first attempt commits `suspended` to Postgres and then throws in Redis. On the retry the
   * status is ALREADY right, and what the operator still needs is the revocation. Before this, the
   * retry threw `Account is already "suspended"` before `logoutAll` was reached, so the account stayed
   * suspended with every session live and the only remedy was unsuspend-then-suspend — undocumented,
   * and not something an operator would guess.
   */
  it('suspend → a retry after a failed revocation still revokes, and says so', async () => {
    const { controller, mocks } = build();
    // What the service now answers on the second call: nothing to write, nothing to conflict over.
    mocks.users.setStatus.mockResolvedValue({
      before: UserStatus.Suspended,
      after: UserStatus.Suspended,
    });

    const result = await controller.suspend(TARGET, ADMIN, req(), { reason: 'spam' });

    // The step the first attempt failed at runs on the retry — this is the recovery.
    expect(mocks.auth.logoutAll).toHaveBeenCalledWith(TARGET, expect.anything());
    // And the message does not claim work it did not do (the `verify` endpoint's precedent).
    expect(result.message).toBe('User was already suspended; sessions revoked.');
    expect(result.before).toBe(UserStatus.Suspended);
    expect(result.after).toBe(UserStatus.Suspended);
    // Still audited: a retry that fixes live sessions is an action, not a no-op.
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserSuspend }),
    );
  });

  it('deactivate → same retry path, same honest message', async () => {
    const { controller, mocks } = build();
    mocks.users.setStatus.mockResolvedValue({
      before: UserStatus.Deactivated,
      after: UserStatus.Deactivated,
    });

    const result = await controller.deactivate(TARGET, ADMIN, req(), {});

    expect(mocks.users.setStatus).toHaveBeenCalledWith(TARGET, UserStatus.Deactivated, {
      allowNoop: true,
    });
    expect(mocks.auth.logoutAll).toHaveBeenCalledWith(TARGET, expect.anything());
    expect(result.message).toBe('User was already deactivated; sessions revoked.');
  });

  it('suspend → a genuine first-time suspension still reports what it did', async () => {
    // The other half of the message branch: the fix must not make every suspension read as a retry.
    const { controller, mocks } = build();
    mocks.users.setStatus.mockResolvedValue({
      before: UserStatus.Active,
      after: UserStatus.Suspended,
    });

    const result = await controller.suspend(TARGET, ADMIN, req(), {});

    expect(result.message).toBe('User suspended.');
  });

  it('unsuspend → requires the account to be suspended', async () => {
    const { controller, mocks } = build();
    mocks.users.setStatus.mockResolvedValue({
      before: UserStatus.Suspended,
      after: UserStatus.Active,
    });
    await controller.unsuspend(TARGET, ADMIN, req(), {});
    expect(mocks.users.setStatus).toHaveBeenCalledWith(TARGET, UserStatus.Active, {
      requireFrom: UserStatus.Suspended,
    });
  });

  it('reset-password → triggers the auth reset flow for the account email', async () => {
    const { controller, mocks } = build();
    mocks.users.adminGetAccount.mockResolvedValue({ email: 'meera@example.com' } as any);
    await controller.resetPassword(TARGET, ADMIN, req(), {});
    expect(mocks.auth.forgotPassword).toHaveBeenCalledWith('meera@example.com');
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserResetPassword }),
    );
  });

  it('force-logout → revokes sessions and audits', async () => {
    const { controller, mocks } = build();
    await controller.forceLogout(TARGET, ADMIN, req(), {});
    expect(mocks.auth.logoutAll).toHaveBeenCalledWith(TARGET, expect.anything());
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserForceLogout }),
    );
  });
});

/**
 * **B9-1, wired end to end.** The tests above prove two halves separately: that the controller passes
 * `allowNoop` and handles a no-op result, and (in `users.admin.service.spec.ts`) that the service
 * honours the flag without writing. Neither can fail if the OTHER half regresses — the controller
 * tests mock `setStatus`, so deleting the service's tolerance leaves them green.
 *
 * This one runs the real `UsersService` over a mocked repository, so the retry is proven as a path
 * rather than as two assumptions that happen to agree. It follows B7's precedent (48 §6.5), where the
 * accept-path cap was held by a test that wired the real service in for exactly this reason.
 */
describe('AdminUsersController.suspend — the retry, with the real UsersService (B9-1)', () => {
  function wired(status: UserStatus) {
    const repo = {
      findById: jest.fn().mockResolvedValue({ id: TARGET, status, email: 'm@x.com' }),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UsersRepository>;
    const users = new UsersService(repo);
    const { mocks } = build();
    const controller = new AdminUsersController(
      users,
      mocks.profiles,
      mocks.roles,
      mocks.pieces,
      mocks.auth,
      mocks.analytics,
      mocks.audit,
    );
    return { controller, repo, mocks };
  }

  it('first attempt: writes the status and revokes', async () => {
    const { controller, repo, mocks } = wired(UserStatus.Active);

    const result = await controller.suspend(TARGET, ADMIN, req(), {});

    expect(repo.update).toHaveBeenCalledWith(TARGET, { status: UserStatus.Suspended });
    expect(mocks.auth.logoutAll).toHaveBeenCalledWith(TARGET, expect.anything());
    expect(result.message).toBe('User suspended.');
  });

  it('retry after the revocation failed: no second write, and the sessions ARE revoked', async () => {
    // The account is already `suspended` — the state the failed first attempt left behind.
    const { controller, repo, mocks } = wired(UserStatus.Suspended);

    const result = await controller.suspend(TARGET, ADMIN, req(), {});

    // Nothing to write, so nothing is written — no `updatedAt` bump misdating the suspension.
    expect(repo.update).not.toHaveBeenCalled();
    // And the step that failed the first time completes. This is the assertion that would have caught
    // the defect: before the fix, the service threw here and `logoutAll` was never reached.
    expect(mocks.auth.logoutAll).toHaveBeenCalledWith(TARGET, expect.anything());
    expect(result.message).toBe('User was already suspended; sessions revoked.');
  });
});

describe('AdminUsersController.bulk', () => {
  it('reports per-id success and failure, then audits the run', async () => {
    const { controller, mocks } = build();
    mocks.users.setEmailVerified.mockImplementation(async (id: string) => {
      if (id === 'u2') {
        throw Object.assign(new Error('already verified'), { code: 'CONFLICT' });
      }
      return { before: false, after: true };
    });

    const result = await controller.bulk({ action: 'verify', userIds: ['u1', 'u2'] }, ADMIN, req());

    expect(result.succeeded).toEqual(['u1']);
    expect(result.failed).toEqual([{ id: 'u2', code: 'CONFLICT', message: 'already verified' }]);
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserBulkAction }),
    );
  });

  it('export action returns exported rows in data (no mutations)', async () => {
    const { controller, mocks } = build();
    mocks.users.adminFindRowsByIds.mockResolvedValue([row()]);
    mocks.pieces.countDraftsByAuthors.mockResolvedValue({ [TARGET]: 1 });

    const result = await controller.bulk({ action: 'export', userIds: [TARGET] }, ADMIN, req());

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({ username: 'meera_k', draftCount: 1 });
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserExport }),
    );
  });
});

describe('AdminUsersController.export (streaming)', () => {
  function fakeRes(): { res: any; chunks: string[]; headers: Record<string, string> } {
    const chunks: string[] = [];
    const headers: Record<string, string> = {};
    const res = {
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
      write: jest.fn((c: string) => {
        chunks.push(c);
        return true;
      }),
      end: jest.fn(),
    };
    return { res, chunks, headers };
  }

  it('streams a CSV header + one row per user and audits the export', async () => {
    const { controller, mocks } = build();
    mocks.users.adminStream.mockImplementation(async function* () {
      yield [row()];
    });
    mocks.pieces.countDraftsByAuthors.mockResolvedValue({ [TARGET]: 0 });
    const { res, chunks, headers } = fakeRes();

    await controller.export({ page: 1, limit: 20, offset: 0 } as any, ADMIN, req(), res);

    expect(headers['Content-Type']).toContain('text/csv');
    expect(chunks[0]).toBe(`${EXPORT_COLUMNS.join(',')}\n`);
    expect(chunks[1]).toContain('meera_k');
    expect(res.end).toHaveBeenCalled();
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.UserExport }),
    );
  });

  it('streams a JSON array when format=json', async () => {
    const { controller, mocks } = build();
    mocks.users.adminStream.mockImplementation(async function* () {
      yield [row()];
    });
    mocks.pieces.countDraftsByAuthors.mockResolvedValue({ [TARGET]: 0 });
    const { res, chunks, headers } = fakeRes();

    await controller.export(
      { page: 1, limit: 20, offset: 0, format: 'json' } as any,
      ADMIN,
      req(),
      res,
    );

    expect(headers['Content-Type']).toContain('application/json');
    expect(chunks[0]).toBe('[');
    expect(chunks[chunks.length - 1]).toBe(']');
  });
});

describe('AdminUsersController read views', () => {
  it('audit trail returns an offset-paginated envelope', async () => {
    const { controller, mocks } = build();
    mocks.audit.listForUser.mockResolvedValue({
      items: [{ id: 'a1', action: 'user.suspend' } as any],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const result = await controller.auditTrail(TARGET, { page: 1, limit: 20, offset: 0 } as any);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(mocks.users.adminGetRow).toHaveBeenCalledWith(TARGET);
  });

  it('login-history surfaces the last login and empties the un-stored fields', async () => {
    const { controller } = build();
    const history = await controller.loginHistory(TARGET);
    expect(history.successfulLogins).toHaveLength(1);
    expect(history.failedLogins).toEqual([]);
    expect(history.devices).toEqual([]);
    expect(history.note).toContain('last successful login');
  });

  it('activity splits audit events into moderation vs account buckets', async () => {
    const { controller, mocks } = build();
    mocks.audit.recentForUser.mockResolvedValue([
      { category: 'status', action: 'user.suspend' } as any,
      { category: 'security', action: 'user.force_logout' } as any,
    ]);
    const activity = await controller.activity(TARGET);
    expect(activity.moderationActivity).toHaveLength(1);
    expect(activity.accountEvents).toHaveLength(1);
    expect(activity.recentLogins).toHaveLength(1);
  });
});
