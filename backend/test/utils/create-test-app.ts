import { ValidationPipe, VersioningType, RequestMethod } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';

import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/common/middleware/request-id.middleware';
import { validationExceptionFactory } from '../../src/common/pipes/validation-exception.factory';

/**
 * Boots the full application for e2e tests with the SAME global wiring as
 * `main.ts` (prefix, versioning, validation pipe, envelope filter/interceptor),
 * so tests observe the real ADR §5 response envelope rather than a stripped-down
 * app. Requires live infra (Postgres + Redis) — e2e runs against real
 * dependencies; Testcontainers automates this in Phase 1.5 (docs 18).
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Mirror main.ts so e2e observes real correlation ids + global wiring.
  const requestId = new RequestIdMiddleware();
  app.use(requestId.use.bind(requestId));

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  return app;
}
