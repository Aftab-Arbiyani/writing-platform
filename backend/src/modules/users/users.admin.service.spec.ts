import { UserStatus } from '@qalam/shared';

import type { User } from './entities/user.entity';
import { UserNotFoundException, UserStatusConflictException } from './exceptions/users.exceptions';
import type { AdminUserRow } from './users.repository';
import type { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

function fakeUser(overrides: Partial<User> = {}): User {
  const emailVerifiedAt = overrides.emailVerifiedAt ?? null;
  return {
    id: 'u1',
    email: 'a@b.com',
    username: 'user_a',
    status: UserStatus.Active,
    emailVerifiedAt,
    passwordHash: null,
    lastLoginAt: null,
    get isEmailVerified() {
      return this.emailVerifiedAt !== null;
    },
    ...overrides,
  } as User;
}

function serviceWith(repo: Partial<UsersRepository>): {
  service: UsersService;
  repo: jest.Mocked<UsersRepository>;
} {
  const mock = {
    findById: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    adminFindRowById: jest.fn(),
    adminList: jest.fn(),
    ...repo,
  } as unknown as jest.Mocked<UsersRepository>;
  return { service: new UsersService(mock), repo: mock };
}

describe('UsersService.setStatus', () => {
  it('transitions active → suspended and reports before/after', async () => {
    const { service, repo } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ status: UserStatus.Active })),
    });
    await expect(service.setStatus('u1', UserStatus.Suspended)).resolves.toEqual({
      before: UserStatus.Active,
      after: UserStatus.Suspended,
    });
    expect(repo.update).toHaveBeenCalledWith('u1', { status: UserStatus.Suspended });
  });

  it('rejects a no-op transition (already in the target state) with a conflict', async () => {
    const { service, repo } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ status: UserStatus.Suspended })),
    });
    await expect(service.setStatus('u1', UserStatus.Suspended)).rejects.toBeInstanceOf(
      UserStatusConflictException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  /*
   * **B9-1** (docs/48 §3.17). `POST :id/suspend` commits the status to Postgres and then revokes
   * sessions in Redis — two stores, one request, no shared transaction. When the revocation threw, the
   * status was already committed and the RETRY was refused right here, so the account sat suspended
   * with every session live and `TokenService.rotate` happily refreshing them for the full 30-day TTL.
   * `allowNoop` is what lets the retry reach the revocation.
   */
  it('tolerates a no-op transition when the caller asks, WITHOUT writing', async () => {
    const { service, repo } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ status: UserStatus.Suspended })),
    });

    await expect(
      service.setStatus('u1', UserStatus.Suspended, { allowNoop: true }),
    ).resolves.toEqual({ before: UserStatus.Suspended, after: UserStatus.Suspended });
    // The row already says this, so touching it would be a write with no change to make — and an
    // `updatedAt` bump that misrepresents when the suspension happened.
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('still conflicts on a no-op by DEFAULT — the flag is opt-in, not a relaxation', async () => {
    // For a direct `PATCH status` the 409 is the useful answer, and `appeals.service` relies on it.
    // Only a caller with a second, non-transactional step needs the tolerance.
    const { service } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ status: UserStatus.Suspended })),
    });

    await expect(service.setStatus('u1', UserStatus.Suspended)).rejects.toBeInstanceOf(
      UserStatusConflictException,
    );
  });

  it('does not let allowNoop override requireFrom', async () => {
    // Two different questions: "is this already done?" (retry-safe) and "is this transition legal
    // from here?" (never). Unsuspending an active account is still a conflict.
    const { service, repo } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ status: UserStatus.Active })),
    });

    await expect(
      service.setStatus('u1', UserStatus.Active, {
        requireFrom: UserStatus.Suspended,
        allowNoop: true,
      }),
    ).rejects.toBeInstanceOf(UserStatusConflictException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('enforces requireFrom (unsuspend only from suspended)', async () => {
    const { service } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ status: UserStatus.Active })),
    });
    await expect(
      service.setStatus('u1', UserStatus.Active, { requireFrom: UserStatus.Suspended }),
    ).rejects.toBeInstanceOf(UserStatusConflictException);
  });

  it('throws USER_NOT_FOUND for an unknown account', async () => {
    const { service } = serviceWith({ findById: jest.fn().mockResolvedValue(null) });
    await expect(service.setStatus('nope', UserStatus.Suspended)).rejects.toBeInstanceOf(
      UserNotFoundException,
    );
  });
});

describe('UsersService.setEmailVerified', () => {
  it('verifies an unverified account and writes a timestamp', async () => {
    const { service, repo } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ emailVerifiedAt: null })),
    });
    await expect(service.setEmailVerified('u1', true)).resolves.toEqual({
      before: false,
      after: true,
    });
    expect(repo.update).toHaveBeenCalledWith('u1', { emailVerifiedAt: expect.any(Date) });
  });

  it('is a no-op write when already in the requested state', async () => {
    const { service, repo } = serviceWith({
      findById: jest.fn().mockResolvedValue(fakeUser({ emailVerifiedAt: new Date() })),
    });
    await expect(service.setEmailVerified('u1', true)).resolves.toEqual({
      before: true,
      after: true,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.adminList', () => {
  it('wraps the repository page in an offset envelope', async () => {
    const rows = [{ id: 'u1' }] as AdminUserRow[];
    const { service } = serviceWith({
      adminList: jest.fn().mockResolvedValue({ rows, total: 42 }),
    });
    const page = await service.adminList({
      sort: { column: 'u.created_at', direction: 'DESC' },
      page: 2,
      offset: 20,
      limit: 20,
    });
    expect(page.items).toBe(rows);
    expect(page.meta).toEqual({ page: 2, limit: 20, total: 42, totalPages: 3 });
  });
});

describe('UsersService.adminGetRow', () => {
  it('throws USER_NOT_FOUND when the row is absent', async () => {
    const { service } = serviceWith({ adminFindRowById: jest.fn().mockResolvedValue(null) });
    await expect(service.adminGetRow('nope')).rejects.toBeInstanceOf(UserNotFoundException);
  });
});
