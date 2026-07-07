import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { validateEnv } from './env.schema';
import { jwtConfig } from './jwt.config';
import { redisConfig } from './redis.config';
import { storageConfig } from './storage.config';

/**
 * Environment configuration, validated once at boot. Wraps `@nestjs/config`
 * `forRoot` with the Zod `validateEnv` gate (a misconfigured process dies with
 * one readable error instead of limping into runtime failures) and registers
 * the five typed namespaces, so any provider can inject
 * `ConfigType<typeof appConfig>` etc.
 *
 * `isGlobal: true` — config is needed everywhere; importing this module once in
 * `AppModule` makes every namespace available app-wide.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, storageConfig],
    }),
  ],
})
export class AppConfigModule {}
