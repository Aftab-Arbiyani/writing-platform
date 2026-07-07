/**
 * Root module — foundation wiring only. Feature modules (auth, users, pieces,
 * taxonomy, engagement, collections, feeds, search, notifications, analytics,
 * moderation, media, prompts, admin) register here in Phase 1 — see
 * src/modules/README.md for the map and boundary rules.
 */
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { v7 as uuidv7 } from 'uuid';

import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.schema';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';
import { storageConfig } from './config/storage.config';

@Module({
  imports: [
    // Env is Zod-validated once at boot (fail-fast). The namespaced factories
    // are loaded globally so any module can inject ConfigType<typeof xConfig>.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, storageConfig],
    }),

    // Structured request logging (pino). Request ids come from the incoming
    // x-request-id header (propagated frontend → API → queue jobs, ADR §9) or
    // a fresh UUIDv7. Credentials are redacted; pretty-printing is dev-only —
    // production ships raw JSON to stdout for the collector.
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level: app.logLevel,
          genReqId: (req) => {
            const header = req.headers['x-request-id'];
            return (Array.isArray(header) ? header[0] : header) ?? uuidv7();
          },
          autoLogging: true,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          ...(app.nodeEnv === 'development'
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { singleLine: true },
                },
              }
            : {}),
        },
      }),
    }),

    // PostgreSQL via TypeORM. synchronize is false ALWAYS — including dev:
    // schema changes ship exclusively as reviewed migrations (ADR §4).
    // autoLoadEntities picks up entities registered by Phase-1 feature modules.
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres' as const,
        url: db.url,
        autoLoadEntities: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        logging: db.logging,
      }),
    }),

    // BullMQ on Redis logical DB 1 (ADR §3 Redis map). The named queues
    // (scheduled-publish, notifications, media-processing, analytics-rollup,
    // trending-score, emails) are registered by their feature modules in
    // Phase 1. maxRetriesPerRequest: null is required by BullMQ's blocking
    // connections.
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) => {
        // Plain options, not an ioredis instance: BullMQ owns its blocking
        // connections, and this sidesteps nominal type clashes between the
        // app's ioredis and the copy bullmq bundles.
        const url = new URL(redis.url);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port !== '' ? url.port : 6379),
            username: url.username !== '' ? url.username : undefined,
            password: url.password !== '' ? url.password : undefined,
            db: redis.queuesDb,
            maxRetriesPerRequest: null,
          },
          prefix: 'qalam:queues',
        };
      },
    }),
  ],
})
export class AppModule {}
