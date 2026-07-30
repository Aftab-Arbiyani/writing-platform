/**
 * Database config namespace — consumed by TypeOrmModule.forRootAsync in
 * app.module.ts. Consumers inject ConfigType<typeof databaseConfig>.
 * Keep in sync with the CLI data source (src/database/data-source.ts).
 */
import { registerAs } from '@nestjs/config';

const num = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const databaseConfig = registerAs('database', () => ({
  /** Required — validateEnv() (env.schema.ts) fails the boot if missing. */
  url: process.env.DATABASE_URL as string,
  /**
   * Optional read-replica DSN (P7.1 replication-ready seam). Empty = single
   * node. When set, wire TypeORM `replication.slaves` in app.module.ts /
   * data-source.ts to route read-only queries here; the write master stays `url`.
   */
  replicaUrl: process.env.DATABASE_REPLICA_URL ?? '',
  /** SQL statement logging piggybacks on LOG_LEVEL (debug/trace only). */
  logging: process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace',
  /**
   * node-postgres connection pool (Epic 12). Size against Postgres
   * `max_connections` ÷ instance count. Default max 10 matches the driver
   * default; raise per deployment. `DB_POOL_*` overrides.
   */
  pool: {
    max: num('DB_POOL_MAX', 10),
    min: num('DB_POOL_MIN', 2),
    idleTimeoutMs: num('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMs: num('DB_POOL_CONN_TIMEOUT_MS', 10_000),
  },
}));
