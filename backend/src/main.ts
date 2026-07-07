/**
 * Qalam API — application bootstrap. Order matters: logger first so boot logs
 * are structured, then security middleware, then request shaping (prefix /
 * versioning / validation), then the response contract (filter + interceptor),
 * then docs.
 */
import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { appConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  // bufferLogs holds early log lines until the pino logger takes over below.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured JSON logging via nestjs-pino (request-scoped correlation ids).
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Typed app config — env already validated by Zod at module init (env.schema.ts).
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Security headers (CSP, HSTS, nosniff, …) — ADR §8 baseline.
  app.use(helmet());

  // CORS: explicit origin allowlist (reader/writer app + admin). credentials
  // is true because web auth uses an httpOnly refresh cookie (ADR §3).
  app.enableCors({
    origin: [config.appUrl, config.adminUrl],
    credentials: true,
  });

  // All routes live under /api; URI versioning yields /api/v1/... (ADR §5).
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // DTO validation at the boundary: strip unknown fields, reject unexpected
  // ones, transform payloads into DTO instances. Implicit conversion stays
  // off — DTOs must declare their coercions explicitly.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Failure contract: every error becomes { success: false, error: { … } } (ADR §5).
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Success contract: every response becomes { success: true, data, meta? } (ADR §5).
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger UI at /docs — never in production. The exported openapi.json is a
  // build artifact feeding the @qalam/api-types codegen pipeline (ADR §3).
  if (config.nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Qalam API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown (SIGTERM from the orchestrator) so TypeORM connections
  // and BullMQ workers close cleanly.
  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`Qalam API listening on port ${config.port} (${config.nodeEnv})`);
}

bootstrap().catch((error: unknown) => {
  // The pino logger may not exist if bootstrap failed early — console is the fallback.
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
