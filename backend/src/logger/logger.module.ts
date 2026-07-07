import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { appConfig } from '../config/app.config';
import { REQUEST_ID_HEADER } from '../common/constants/http.constants';

/**
 * Structured logging via `nestjs-pino` (ADR §3 chose Pino over Winston; docs 14).
 * This is also the platform's request logger — `pino-http` `autoLogging` emits
 * exactly one line per request. We deliberately do NOT add a separate Nest
 * "logging interceptor": that would double-log every request (docs 16 §3.4).
 *
 * `genReqId` reads the `X-Request-Id` that `RequestIdMiddleware` guarantees on
 * the request, so the HTTP log line, the request-scoped child logger, the
 * response header, and downstream BullMQ jobs all share one correlation id
 * (ADR §9). Credentials are redacted; pretty-printing is dev-only — production
 * ships raw JSON to stdout for the collector.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level: app.logLevel,
          genReqId: (req) => {
            const header = req.headers[REQUEST_ID_HEADER];
            return (Array.isArray(header) ? header[0] : header) ?? 'unknown';
          },
          autoLogging: true,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          ...(app.nodeEnv === 'development'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
