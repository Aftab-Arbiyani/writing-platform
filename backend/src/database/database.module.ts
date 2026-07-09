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
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres' as const,
        url: db.url,
        autoLoadEntities: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        logging: db.logging,
        // Connection pool (Epic 12) — explicit + production-tunable (DB_POOL_*).
        extra: {
          max: db.pool.max,
          min: db.pool.min,
          idleTimeoutMillis: db.pool.idleTimeoutMs,
          connectionTimeoutMillis: db.pool.connectionTimeoutMs,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
