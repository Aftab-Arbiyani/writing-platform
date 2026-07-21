import { Logger } from '@nestjs/common';
import { Role } from '@qalam/shared';
import type { EntityManager } from 'typeorm';

import type { TransactionRunner } from '../../common/database/transaction-runner';
import type { PasswordService } from '../../modules/auth/services/password.service';
import type { RolesService } from '../../modules/users/roles.service';
import type { UsersService } from '../../modules/users/users.service';
import type { User } from '../../modules/users/entities/user.entity';
import { seedSuperAdmin, type SuperAdminSeedDeps } from './super-admin.seed';

function makeDeps(overrides: Partial<Record<keyof SuperAdminSeedDeps, unknown>> = {}) {
  const users = {
    findByEmail: jest.fn().mockResolvedValue(null),
    isUsernameTaken: jest.fn().mockResolvedValue(false),
    createLocalUser: jest.fn().mockResolvedValue({ id: 'u-1' } as User),
    markEmailVerified: jest.fn().mockResolvedValue(undefined),
  };
  const roles = { grantRole: jest.fn().mockResolvedValue(undefined) };
  const passwords = {
    assertStrong: jest.fn(),
    hash: jest.fn().mockResolvedValue('argon2-hash'),
  };
  const transactions = {
    run: jest.fn((fn: (m: EntityManager) => Promise<unknown>) => fn({} as EntityManager)),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const deps: SuperAdminSeedDeps = {
    users: users as unknown as UsersService,
    roles: roles as unknown as RolesService,
    passwords: passwords as unknown as PasswordService,
    transactions: transactions as unknown as TransactionRunner,
    logger: logger as unknown as Logger,
    ...(overrides as Partial<SuperAdminSeedDeps>),
  };
  return { deps, users, roles, passwords, transactions, logger };
}

describe('seedSuperAdmin', () => {
  const ENV = process.env;
  beforeEach(() => {
    process.env = { ...ENV };
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_USERNAME;
    delete process.env.SUPER_ADMIN_PASSWORD;
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env = ENV;
  });

  it('creates a pre-verified super-admin from dev defaults + grants super_admin', async () => {
    const { deps, users, roles, passwords } = makeDeps();
    await seedSuperAdmin(deps);
    expect(passwords.hash).toHaveBeenCalled();
    expect(users.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@qalam.local', username: 'superadmin' }),
      expect.anything(),
    );
    expect(users.markEmailVerified).toHaveBeenCalledWith('u-1', expect.anything());
    expect(roles.grantRole).toHaveBeenCalledWith('u-1', Role.SuperAdmin, null, expect.anything());
  });

  it('uses env credentials when provided', async () => {
    process.env.SUPER_ADMIN_EMAIL = 'Boss@Qalam.com';
    process.env.SUPER_ADMIN_USERNAME = 'boss';
    process.env.SUPER_ADMIN_PASSWORD = 'a-strong-passphrase-123';
    const { deps, users } = makeDeps();
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'boss@qalam.com', username: 'boss' }),
      expect.anything(),
    );
  });

  it('is idempotent: only ensures the role when the email already exists', async () => {
    const { deps, users, roles } = makeDeps();
    users.findByEmail.mockResolvedValue({ id: 'existing' } as User);
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).not.toHaveBeenCalled();
    expect(roles.grantRole).toHaveBeenCalledWith('existing', Role.SuperAdmin, null);
  });

  it('SKIPS in production when credentials are not supplied', async () => {
    process.env.NODE_ENV = 'production';
    const { deps, users, logger } = makeDeps();
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('SKIPPED'));
  });

  it('creates in production when all credentials are supplied', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPER_ADMIN_EMAIL = 'ops@qalam.app';
    process.env.SUPER_ADMIN_USERNAME = 'ops_admin';
    process.env.SUPER_ADMIN_PASSWORD = 'prod-strong-passphrase-9';
    const { deps, users } = makeDeps();
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).toHaveBeenCalled();
  });

  it('skips (no throw) when the password fails the strength policy', async () => {
    process.env.SUPER_ADMIN_PASSWORD = 'weak';
    const { deps, users, passwords, logger } = makeDeps();
    passwords.assertStrong.mockImplementation(() => {
      throw new Error('weak');
    });
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('password policy'));
  });

  it('skips when the username has an invalid format', async () => {
    process.env.SUPER_ADMIN_USERNAME = 'Bad Name!';
    const { deps, users, logger } = makeDeps();
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('must match'));
  });

  it('skips when the username is taken by another account', async () => {
    const { deps, users, logger } = makeDeps();
    users.isUsernameTaken.mockResolvedValue(true);
    await seedSuperAdmin(deps);
    expect(users.createLocalUser).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('taken'));
  });
});
