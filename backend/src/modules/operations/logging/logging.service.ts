import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { REDACT_PATHS } from '../../../logger/redaction';
import { operationsConfig } from '../../../config/operations.config';
import { LOG_CLASS, type LogClass } from '../operations.constants';

/** The logging posture the observability report + admin Log dashboard expose. */
export interface LoggingPosture {
  readonly structured: boolean;
  readonly format: 'json';
  readonly transport: 'stdout';
  readonly correlation: readonly string[];
  readonly context: readonly string[];
  readonly sampleRate: number;
  readonly retentionDays: number;
  readonly redactionEnforced: boolean;
  readonly redactedPaths: number;
  readonly classes: readonly {
    readonly class: LogClass;
    readonly sampled: boolean;
    readonly retention: string;
  }[];
  readonly aggregationReady: boolean;
}

/**
 * Logging Service (P7.4) — the SSOT for the platform's structured-logging
 * POLICY: classification, sampling, retention, and the redaction contract. It
 * does NOT re-implement logging: the runtime logger is `AppLoggerModule`
 * (nestjs-pino → JSON to stdout, correlation/request/trace + deployment context,
 * redaction via the shared {@link REDACT_PATHS}). This service exposes that
 * posture and the per-class sampling/retention rules so the Operations Platform
 * governs logging centrally instead of each module inventing its own.
 *
 * The contract is aggregation-ready: JSON-to-stdout is exactly what an ELK / Loki
 * / CloudWatch / Datadog collector ingests, with no code change — the "future
 * compatibility without architectural change" mandate.
 */
@Injectable()
export class LoggingService {
  constructor(
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {}

  /** The current logging posture (read-only observability view). */
  posture(): LoggingPosture {
    const retentionDays = this.config.logging.retentionDays;
    return {
      structured: true,
      format: 'json',
      transport: 'stdout',
      correlation: ['correlationId', 'requestId', 'traceId'],
      context: ['userId', 'sessionVersion', 'service', 'env', 'version', 'commit', 'instanceId'],
      sampleRate: this.config.logging.sampleRate,
      retentionDays,
      redactionEnforced: true,
      redactedPaths: REDACT_PATHS.length,
      classes: [
        { class: LOG_CLASS.Error, sampled: false, retention: `${retentionDays}d (never sampled)` },
        { class: LOG_CLASS.Audit, sampled: false, retention: 'compliance (never sampled)' },
        {
          class: LOG_CLASS.Access,
          sampled: this.config.logging.sampleRate < 1,
          retention: `${retentionDays}d`,
        },
        {
          class: LOG_CLASS.Application,
          sampled: this.config.logging.sampleRate < 1,
          retention: `${Math.min(7, retentionDays)}d`,
        },
      ],
      aggregationReady: true,
    };
  }

  /**
   * Classify a log by level → its retention/sampling class. Errors + audit are
   * never sampled; access + application follow `LOG_SAMPLE_RATE`. This is the one
   * place the classification lives (governance reads it).
   */
  classify(level: 'error' | 'warn' | 'info' | 'debug' | 'audit'): LogClass {
    switch (level) {
      case 'error':
      case 'warn':
        return LOG_CLASS.Error;
      case 'audit':
        return LOG_CLASS.Audit;
      case 'info':
        return LOG_CLASS.Access;
      default:
        return LOG_CLASS.Application;
    }
  }
}
