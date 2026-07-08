import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { RolesService } from '../../modules/users/roles.service';
import { TaxonomyRepository } from '../../modules/taxonomy/taxonomy.repository';
import { seedTaxonomy } from './taxonomy.seed';

/**
 * Idempotent seed runner (docs 04 §9) — insert-if-missing by natural key, safe
 * to re-run, run as a deploy step **after** migrations. Boots the full app
 * context (infra is up at deploy time) so all `@Global` provider dependencies
 * resolve. Currently seeds RBAC roles + taxonomy (languages, genres).
 *
 * TODO(aftab): bootstrap super-admin from SUPER_ADMIN_EMAIL/PASSWORD env on first
 * deploy (docs 04 §9) — needs the auth module's PasswordService.
 */
async function runSeeds(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  try {
    await app.get(RolesService).seedRoles();
    logger.log('Roles seeded (user, moderator, admin, super_admin).');
    await seedTaxonomy(app.get(TaxonomyRepository));
    logger.log('Taxonomy seeded (languages hi/ur/en, 8 genres).');
  } finally {
    await app.close();
  }
}

runSeeds().catch((error: unknown) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
