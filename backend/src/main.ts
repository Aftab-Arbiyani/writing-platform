/**
 * Qalam API — application bootstrap. Order matters: logger first so boot logs
 * are structured, then security middleware, then request shaping (prefix /
 * versioning / validation), then the response contract (filter + interceptor),
 * then docs.
 */
// MUST be first — initializes Sentry before Nest/OpenTelemetry so auto-instrumentation
// hooks are in place (docs 14 §2). No-op when SENTRY_DSN is empty.
import './instrument';

import 'reflect-metadata';

import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './common/constants/http.constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';
import { appConfig } from './config/app.config';
// Populated at import time (via ./instrument) from container/file-mounted secrets.
import { containerSecrets } from './config/bootstrap-secrets';
import { deploymentConfig } from './config/deployment.config';

async function bootstrap(): Promise<void> {
  // bufferLogs holds early log lines until the pino logger takes over below.
  // rawBody captures the unparsed request buffer (req.rawBody) so payment webhook
  // handlers can verify a provider's HMAC signature over the exact bytes (AF5).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // Structured JSON logging via nestjs-pino (request-scoped correlation ids).
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Typed app config — env already validated by Zod at module init (env.schema.ts).
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const deployment = app.get<ConfigType<typeof deploymentConfig>>(deploymentConfig.KEY);
  const isProd = config.nodeEnv === 'production';

  // Trust the edge proxy's X-Forwarded-* chain so client IPs (rate limiting),
  // `secure` cookies and protocol detection are correct behind nginx/an LB
  // (P7.1). 0 hops = don't trust (direct-exposed dev). Express-specific setting.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? '0');
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  // Correlation id FIRST (ADR §9): honor a trusted proxy's X-Request-Id or mint
  // a UUIDv7, echo it on the response, and expose it so nestjs-pino binds the
  // same id to the request logger. Registered app-level so it runs ahead of the
  // pino middleware and every other handler.
  const requestId = new RequestIdMiddleware();
  app.use(requestId.use.bind(requestId));

  // Security headers (CSP, HSTS, nosniff, …) — ADR §8 baseline, hardened for
  // deployed tiers (P7.1/P7.2): a JSON API needs NO script/style/img sources, so
  // the CSP is locked to `default-src 'none'; frame-ancestors 'none'` (docs 13
  // §5.4); 1-year HSTS w/ preload; strict referrer + same-origin resource policy;
  // frameguard DENY (clickjacking). TLS terminates at the edge — HSTS only takes
  // effect over HTTPS, harmless in dev over http.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          objectSrc: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : undefined,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      frameguard: { action: 'deny' },
    }),
  );

  // Permissions-Policy (P7.2) — helmet does not set this. A JSON API needs none
  // of these browser features; deny them so an embedded/proxied context cannot
  // request them.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    );
    next();
  });

  // Request-size guard (P7.2 "Request Size Limits") — reject oversized JSON/form
  // bodies by Content-Length BEFORE parsing. Multipart uploads are EXEMPT (multer
  // enforces its own per-kind caps) and the raw-body webhook path is untouched,
  // so this adds an explicit cap without disturbing parsing. Returns the standard
  // error envelope.
  const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MiB
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentType = String(req.headers['content-type'] ?? '');
    const length = Number(req.headers['content-length'] ?? 0);
    if (!contentType.includes('multipart/form-data') && length > MAX_BODY_BYTES) {
      res.status(413).json({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the size limit.' },
      });
      return;
    }
    next();
  });

  // Response compression. nginx also compresses in prod (docs 15); enabling it
  // here keeps dev + non-nginx deploys covered without harming the proxied path.
  app.use(compression());

  // Parses the httpOnly refresh cookie for web clients (docs 13 §3.3).
  app.use(cookieParser());

  // CORS: explicit origin allowlist (reader/writer app + admin). credentials
  // is true because web auth uses an httpOnly refresh cookie (ADR §3).
  app.enableCors({
    origin: [config.appUrl, config.adminUrl],
    credentials: true,
    // Pin methods + request headers explicitly (docs 13 §5.6) — never reflect.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-Id',
      'X-Client',
      'Idempotency-Key',
    ],
    // Let browser clients read the correlation id (support tickets, tracing).
    exposedHeaders: [REQUEST_ID_HEADER],
    // Cache preflight for a day to cut OPTIONS chatter.
    maxAge: 86_400,
  });

  // All routes live under /api; URI versioning yields /api/v1/... (ADR §5).
  // Health + metrics probes are excluded so orchestrators/scrapers hit bare
  // /health/* and /metrics (version-neutral) without knowing the API version
  // (docs 14 §3/§4). `health/(.*)` covers every per-dependency probe.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/(.*)', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
      { path: 'version', method: RequestMethod.GET },
    ],
  });
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
      // Emit the ADR §5 `VALIDATION_FAILED` envelope with structured
      // { field, rule, message } details (docs 05 §3.2).
      exceptionFactory: validationExceptionFactory,
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
      .setDescription(
        [
          'Qalam backend REST API (URI-versioned under `/api/v1`).',
          '',
          'Every success response is wrapped in `{ success: true, data, meta? }`;',
          'list endpoints add `meta.pagination`. Every error is',
          '`{ success: false, error: { code, message, details, requestId } }` where',
          '`code` is a stable `@qalam/shared` `ERROR_CODES` value and `requestId`',
          'correlates the client error, the server log line, and the Sentry event.',
          'Common statuses: 400 `VALIDATION_FAILED`, 401 `UNAUTHORIZED`,',
          '403 `AUTH_PERMISSION_DENIED`, 404 `NOT_FOUND`, 409 `CONFLICT`,',
          '429 `RATE_LIMITED` (with `Retry-After`).',
        ].join('\n'),
      )
      .setVersion('1.0')
      .addServer(config.apiUrl, 'This environment')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown (SIGTERM from the orchestrator) so TypeORM connections
  // and BullMQ workers close cleanly.
  app.enableShutdownHooks();

  await app.listen(config.port);

  // Structured deployment event (P7.1 observability): one machine-parseable line
  // carrying the full build/instance identity so a log search can pin "which
  // version started when, where". Secret *names* only — never values.
  logger.log({
    event: 'deployment.started',
    service: deployment.serviceName,
    environment: deployment.environment,
    version: deployment.version,
    commit: deployment.gitShaShort,
    buildNumber: deployment.buildNumber,
    releaseChannel: deployment.releaseChannel,
    instanceId: deployment.instanceId,
    configVersion: deployment.configVersion,
    port: config.port,
    workersEnabled: process.env.WORKERS_ENABLED !== 'false',
    containerSecretsLoaded: containerSecrets.loaded,
    containerSecretSource: containerSecrets.source,
  });
}

bootstrap().catch((error: unknown) => {
  // The pino logger may not exist if bootstrap failed early — console is the fallback.
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
