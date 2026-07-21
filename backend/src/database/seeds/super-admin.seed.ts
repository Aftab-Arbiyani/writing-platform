import { Logger } from '@nestjs/common';
import { Role, USERNAME_REGEX } from '@qalam/shared';

import { TransactionRunner } from '../../common/database/transaction-runner';
import { PasswordService } from '../../modules/auth/services/password.service';
import { RolesService } from '../../modules/users/roles.service';
import { UsersService } from '../../modules/users/users.service';

/**
 * Bootstrap super-admin seed (docs 04 §9). Creates the FIRST `super_admin`
 * account so a fresh deployment has an operator who can grant every other role —
 * the platform ships with no privileged account otherwise.
 *
 * Security posture (docs 13 §3):
 * - Credentials come from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_USERNAME` /
 *   `SUPER_ADMIN_PASSWORD` env — never hard-coded. The password is hashed with
 *   the SAME argon2id policy as registration (reuses {@link PasswordService}) and
 *   run through the strength policy; the plaintext is never persisted or logged.
 * - In **production** the seed REFUSES to create a default-credential admin: if
 *   any of the three env vars is missing it skips with a loud warning (so a
 *   known-password admin never lands in prod by accident).
 * - Outside production, convenient dev defaults are used and a warning tells the
 *   operator to change them before any shared use.
 * - Idempotent: if the email already exists it only ensures the `super_admin`
 *   role is granted (never resets a rotated password). Runs LAST, after the roles
 *   seed, so the role exists to grant.
 */

/** Dev-only defaults (applied only when NODE_ENV !== production). */
const DEV_DEFAULTS = {
  email: 'admin@qalam.local',
  username: 'superadmin',
  password: 'ChangeMe!SuperAdmin1',
} as const;

export interface SuperAdminSeedDeps {
  readonly users: UsersService;
  readonly roles: RolesService;
  readonly passwords: PasswordService;
  readonly transactions: TransactionRunner;
  readonly logger: Logger;
}

export async function seedSuperAdmin(deps: SuperAdminSeedDeps): Promise<void> {
  const { users, roles, passwords, transactions, logger } = deps;
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

  const email = (process.env.SUPER_ADMIN_EMAIL ?? (isProduction ? '' : DEV_DEFAULTS.email))
    .trim()
    .toLowerCase();
  const username = (process.env.SUPER_ADMIN_USERNAME ?? (isProduction ? '' : DEV_DEFAULTS.username))
    .trim()
    .toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? (isProduction ? '' : DEV_DEFAULTS.password);

  if (email === '' || username === '' || password === '') {
    logger.warn(
      isProduction
        ? 'Super-admin seed SKIPPED: set SUPER_ADMIN_EMAIL, SUPER_ADMIN_USERNAME, and ' +
            'SUPER_ADMIN_PASSWORD to bootstrap the first super admin in production.'
        : 'Super-admin seed skipped: no credentials resolved.',
    );
    return;
  }

  if (!USERNAME_REGEX.test(username)) {
    logger.error(
      `Super-admin seed skipped: SUPER_ADMIN_USERNAME "${username}" must match ${USERNAME_REGEX.source}.`,
    );
    return;
  }

  // Idempotent: an existing account only needs its role ensured (never re-hash).
  const existing = await users.findByEmail(email);
  if (existing !== null) {
    await roles.grantRole(existing.id, Role.SuperAdmin, null);
    logger.log(`Super-admin already present (${email}); ensured super_admin role.`);
    return;
  }

  if (await users.isUsernameTaken(username)) {
    logger.error(
      `Super-admin seed skipped: username "${username}" is taken by another account. ` +
        'Set SUPER_ADMIN_USERNAME to a free handle.',
    );
    return;
  }

  try {
    passwords.assertStrong(password);
  } catch {
    logger.error(
      'Super-admin seed skipped: SUPER_ADMIN_PASSWORD does not meet the password policy ' +
        '(10–128 chars, not a common password). Choose a stronger password.',
    );
    return;
  }

  const passwordHash = await passwords.hash(password);
  await transactions.run(async (manager) => {
    // Pre-verified (a bootstrap account has no mailbox to confirm) + active.
    const created = await users.createLocalUser({ email, username, passwordHash }, manager);
    await users.markEmailVerified(created.id, manager);
    await roles.grantRole(created.id, Role.SuperAdmin, null, manager);
  });

  logger.log(`Super-admin created: ${email} (username: ${username}, role: super_admin).`);
  if (!isProduction && process.env.SUPER_ADMIN_PASSWORD === undefined) {
    logger.warn(
      'Using the DEV DEFAULT super-admin password — change it (or set SUPER_ADMIN_PASSWORD) ' +
        'before any shared/staging/production use.',
    );
  }
}
