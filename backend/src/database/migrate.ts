/**
 * Compiled migration entrypoint (P7.1) — run migrations in the PRODUCTION image
 * without dev dependencies. The `migration:run`/`migration:revert` package
 * scripts use `typeorm-ts-node-commonjs` (ts-node, a devDependency) which the
 * pruned prod image (`pnpm deploy --prod`) does not ship. This file compiles to
 * `dist/database/migrate.js` and drives the same DataSource programmatically:
 *
 *     node dist/database/migrate.js up      # apply all pending (deploy step)
 *     node dist/database/migrate.js down    # revert the last migration
 *     node dist/database/migrate.js show    # exit 1 if migrations are pending
 *
 * The advisory-lock + audit bookkeeping lives in scripts/db/migrate.sh, which
 * shells out to this command via MIGRATE_CMD — so run migrations through that
 * wrapper in production, not this entrypoint directly.
 */
import 'reflect-metadata';

import dataSource from './data-source';

type Direction = 'up' | 'down' | 'show';

async function main(): Promise<void> {
  const direction = (process.argv[2] ?? 'up') as Direction;
  await dataSource.initialize();
  try {
    switch (direction) {
      case 'up': {
        const applied = await dataSource.runMigrations({ transaction: 'each' });
        const names = applied.map((m) => m.name).join(', ');
        console.log(`migrate: applied ${applied.length} migration(s)${names ? `: ${names}` : ''}`);
        break;
      }
      case 'down': {
        await dataSource.undoLastMigration({ transaction: 'each' });
        console.log('migrate: reverted the last migration');
        break;
      }
      case 'show': {
        const hasPending = await dataSource.showMigrations();
        console.log(hasPending ? 'migrate: pending migrations exist' : 'migrate: up to date');
        process.exitCode = hasPending ? 1 : 0;
        break;
      }
      default:
        throw new Error(`unknown direction "${direction}" (use up | down | show)`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('migrate: failed —', error);
  process.exit(1);
});
