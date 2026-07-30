import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { TransactionRunner } from '../../common/database/transaction-runner';
import { PasswordService } from '../../modules/auth/services/password.service';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { RolesService } from '../../modules/users/roles.service';
import { UsersService } from '../../modules/users/users.service';
import { TaxonomyRepository } from '../../modules/taxonomy/taxonomy.repository';
import { seedSuperAdmin } from './super-admin.seed';
import { seedTaxonomy } from './taxonomy.seed';

/**
 * Idempotent seed runner (docs 04 §9) — insert-if-missing by natural key, safe
 * to re-run, run as a deploy step **after** migrations. Boots the full app
 * context (infra is up at deploy time) so all `@Global` provider dependencies
 * resolve. Seeds RBAC roles + PBAC permissions + taxonomy, then bootstraps the
 * first super-admin (env-gated; see {@link seedSuperAdmin}).
 */
async function runSeeds(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  try {
    await app.get(RolesService).seedRoles();
    logger.log('Roles seeded (user, moderator, admin, super_admin).');
    await app.get(PermissionsService).seed();
    logger.log('Permissions + role mappings seeded (PBAC).');
    await seedTaxonomy(app.get(TaxonomyRepository));
    logger.log('Taxonomy seeded (languages hi/ur/en, 8 genres).');
    // Bootstrap super-admin LAST — the roles seed above must exist to grant it.
    await seedSuperAdmin({
      users: app.get(UsersService),
      roles: app.get(RolesService),
      passwords: app.get(PasswordService),
      transactions: app.get(TransactionRunner),
      logger,
    });
  } finally {
    await app.close();
  }
}

runSeeds().catch((error: unknown) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
