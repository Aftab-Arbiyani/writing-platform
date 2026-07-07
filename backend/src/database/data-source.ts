/**
 * TypeORM CLI data source — used ONLY by the migration scripts in package.json:
 *
 *   pnpm migration:generate src/database/migrations/<Name>
 *   pnpm migration:run
 *   pnpm migration:revert
 *
 * Those scripts invoke `typeorm-ts-node-commonjs` (typeorm's bundled CLI
 * wrapper that registers ts-node in CommonJS mode — hence the ts-node dev
 * dependency) with `-d src/database/data-source.ts` pointing at this file.
 *
 * The runtime app configures TypeORM separately in app.module.ts — keep the
 * two in sync (SnakeNamingStrategy, synchronize: false).
 */
import 'dotenv/config';
import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env first.');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  // ts globs serve the CLI via ts-node; dist globs serve compiled contexts
  // (e.g. running migrations from a built image during deploy).
  entities: ['src/**/*.entity.ts', 'dist/**/*.entity.js'],
  migrations: ['src/database/migrations/*.ts', 'dist/database/migrations/*.js'],
  namingStrategy: new SnakeNamingStrategy(),
  // Migrations only — never schema sync, in any environment (ADR §4).
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
