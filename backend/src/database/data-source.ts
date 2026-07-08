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

// Select TS globs under ts-node (CLI) and compiled JS globs in a built image —
// never both, or a compiled `dist/` would double-register every migration/entity
// ("Duplicate migrations"). Keyed on how this data source itself was loaded.
const isTsRuntime = __filename.endsWith('.ts');
const entityGlob = isTsRuntime ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js';
const migrationGlob = isTsRuntime
  ? 'src/database/migrations/*.ts'
  : 'dist/database/migrations/*.js';

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [entityGlob],
  migrations: [migrationGlob],
  namingStrategy: new SnakeNamingStrategy(),
  // Migrations only — never schema sync, in any environment (ADR §4).
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
