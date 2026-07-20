import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { aiConfig } from './ai.config';
import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { ConfigInspectorService } from './config-inspector.service';
import { databaseConfig } from './database.config';
import { deploymentConfig } from './deployment.config';
import { validateEnv } from './env.schema';
import { jwtConfig } from './jwt.config';
import { mailConfig } from './mail.config';
import { paymentsConfig } from './payments.config';
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
 * `AppModule` makes every namespace available app-wide. `@Global` additionally
 * exports `ConfigInspectorService` (config/secret health, P7.1) app-wide.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        mailConfig,
        storageConfig,
        aiConfig,
        paymentsConfig,
        deploymentConfig,
      ],
    }),
  ],
  providers: [ConfigInspectorService],
  exports: [ConfigInspectorService],
})
export class AppConfigModule {}
