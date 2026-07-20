import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { databaseConfig } from '../config/database.config';

/**
 * PostgreSQL via TypeORM. `synchronize` is **false always** — including dev:
 * schema changes ship exclusively as reviewed migrations (ADR §4 / docs 04 §1.6),
 * run as an explicit deploy step, never at boot.
 *
 * `autoLoadEntities` picks up entities registered by Phase-1 feature modules
 * (via `TypeOrmModule.forFeature`). Keep this factory in sync with the CLI data
 * source (`src/database/data-source.ts`): same naming strategy, same
 * synchronize policy.
 *
 * P7.1 replication-ready seam: when `DATABASE_REPLICA_URL` is set, TypeORM
 * routes writes to the master and reads to the replica automatically — a single
 * env var flips single-node → read-replica with no code change. Unset = single
 * node (unchanged behaviour).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => {
        const extra = {
          max: db.pool.max,
          min: db.pool.min,
          idleTimeoutMillis: db.pool.idleTimeoutMs,
          connectionTimeoutMillis: db.pool.connectionTimeoutMs,
        };
        const base = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: false,
          namingStrategy: new SnakeNamingStrategy(),
          logging: db.logging,
          // Connection pool (Epic 12) — explicit + production-tunable (DB_POOL_*).
          extra,
        };
        if (db.replicaUrl.length > 0) {
          return {
            ...base,
            replication: {
              master: { url: db.url, ...extra },
              slaves: [{ url: db.replicaUrl, ...extra }],
            },
          };
        }
        return { ...base, url: db.url };
      },
    }),
  ],
})
export class DatabaseModule {}
