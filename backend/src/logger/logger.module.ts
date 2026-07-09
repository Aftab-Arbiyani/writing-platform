import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { appConfig } from '../config/app.config';
import { REQUEST_ID_HEADER } from '../common/constants/http.constants';
import { REDACT_CENSOR, REDACT_PATHS } from './redaction';

/**
 * Structured logging via `nestjs-pino` (ADR §3 chose Pino over Winston; docs 14).
 * This is also the platform's request logger — `pino-http` `autoLogging` emits
 * exactly one line per request. We deliberately do NOT add a separate Nest
 * "logging interceptor": that would double-log every request (docs 16 §3.4).
 *
 * `genReqId` reads the `X-Request-Id` that `RequestIdMiddleware` guarantees on
 * the request, so the HTTP log line, the request-scoped child logger, the
 * response header, and downstream BullMQ jobs all share one correlation id
 * (ADR §9). Sensitive fields are redacted via the shared {@link REDACT_PATHS}
 * contract (docs 14 §1.6 / 13 §13). Pretty-printing is opt-in (`LOG_PRETTY=true`,
 * default on in development); staging/production ship raw JSON to stdout only.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => {
        const pretty = process.env.LOG_PRETTY === 'true' || app.nodeEnv === 'development';
        return {
          pinoHttp: {
            level: app.logLevel,
            genReqId: (req) => {
              const header = req.headers[REQUEST_ID_HEADER];
              return (Array.isArray(header) ? header[0] : header) ?? 'unknown';
            },
            autoLogging: true,
            redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
            ...(pretty
              ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
              : {}),
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}
