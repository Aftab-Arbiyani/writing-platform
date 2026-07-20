/**
 * Config & secret inspection (P7.1 "Configuration Health Checks" + "Secret
 * Health Checks" + "Configuration Audit"). Reports the *presence and validity*
 * of configuration and secrets — never their values. Feeds:
 *   - the `ConfigHealthIndicator` (`GET /health/config`, `/health/ready` gate),
 *   - the public/admin version + config-health endpoints,
 *   - the boot audit log line.
 *
 * Hard rule: this service must never return, log, or expose a secret value.
 * Only booleans, lengths, and a salted fingerprint leave it.
 */
import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { deploymentConfig } from './deployment.config';
import { isDevPlaceholderSecret, isProtectedEnvironment } from './env.schema';

/** Why a secret matters — drives whether "absent" is an error or just info. */
export type SecretRequirement =
  | 'always' // required in every environment (boot already enforces)
  | 'protected' // required on deployed tiers (qa/staging/preview/production)
  | 'optional'; // feature-gated; absent = that feature stays inert

export interface SecretStatus {
  readonly name: string;
  /** What this secret unlocks, for the admin view. */
  readonly purpose: string;
  readonly requirement: SecretRequirement;
  /** Set and not a dev placeholder. */
  readonly present: boolean;
  /** Present AND passes shape rules (e.g. min length). */
  readonly valid: boolean;
  /** Looks like a leftover dev/sample credential. */
  readonly isPlaceholder: boolean;
}

export type ConfigHealthStatus = 'ok' | 'degraded' | 'error';

export interface ConfigHealthReport {
  readonly status: ConfigHealthStatus;
  readonly environment: string;
  readonly protectedEnvironment: boolean;
  readonly configVersion: string;
  readonly checkedAt: string;
  /** Stable hash of non-secret config; changes when config drifts. */
  readonly fingerprint: string;
  readonly secrets: readonly SecretStatus[];
  /** Human-readable problems (missing required / placeholder in prod). */
  readonly issues: readonly string[];
}

interface SecretSpec {
  readonly name: string;
  readonly purpose: string;
  readonly requirement: SecretRequirement;
  /** Optional extra validity rule beyond "present & not placeholder". */
  readonly minLength?: number;
}

/**
 * Catalogue of every secret the platform consumes. Adding a secret here makes
 * it visible in the config-health report and admin view automatically.
 */
const SECRET_CATALOG: readonly SecretSpec[] = [
  { name: 'DATABASE_URL', purpose: 'PostgreSQL connection', requirement: 'always' },
  {
    name: 'JWT_ACCESS_SECRET',
    purpose: 'Access-token signing',
    requirement: 'always',
    minLength: 32,
  },
  {
    name: 'JWT_REFRESH_SECRET',
    purpose: 'Refresh-token signing',
    requirement: 'always',
    minLength: 32,
  },
  { name: 'REDIS_URL', purpose: 'Cache / queues', requirement: 'always' },
  { name: 'S3_ACCESS_KEY', purpose: 'Object storage', requirement: 'protected' },
  { name: 'S3_SECRET_KEY', purpose: 'Object storage', requirement: 'protected' },
  { name: 'SMTP_URL', purpose: 'Outbound mail', requirement: 'protected' },
  { name: 'SENTRY_DSN', purpose: 'Error reporting', requirement: 'optional' },
  { name: 'GOOGLE_CLIENT_ID', purpose: 'Google sign-in', requirement: 'optional' },
  { name: 'GOOGLE_CLIENT_SECRET', purpose: 'Google sign-in', requirement: 'optional' },
  { name: 'OPENAI_API_KEY', purpose: 'AI provider (OpenAI)', requirement: 'optional' },
  { name: 'ANTHROPIC_API_KEY', purpose: 'AI provider (Anthropic)', requirement: 'optional' },
  { name: 'GOOGLE_AI_API_KEY', purpose: 'AI provider (Google)', requirement: 'optional' },
  { name: 'STRIPE_SECRET_KEY', purpose: 'Payments (Stripe)', requirement: 'optional' },
  { name: 'STRIPE_WEBHOOK_SECRET', purpose: 'Payments webhook verify', requirement: 'optional' },
  { name: 'APPLE_SHARED_SECRET', purpose: 'Payments (Apple IAP)', requirement: 'optional' },
  {
    name: 'GOOGLE_PLAY_SERVICE_ACCOUNT_KEY',
    purpose: 'Payments (Google Play)',
    requirement: 'optional',
  },
  { name: 'METRICS_TOKEN', purpose: 'Metrics endpoint guard', requirement: 'protected' },
];

/** Non-secret config keys whose values are safe to fingerprint / surface. */
const NON_SECRET_KEYS: readonly string[] = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'LOG_PRETTY',
  'APP_URL',
  'ADMIN_URL',
  'API_URL',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'CDN_URL',
  'RATE_LIMIT_ENABLED',
  'WORKERS_ENABLED',
  'SCHEDULER_ENABLED',
  'DB_POOL_MAX',
  'DB_POOL_MIN',
  'SENTRY_TRACES_SAMPLE_RATE',
  'RELEASE_CHANNEL',
];

@Injectable()
export class ConfigInspectorService {
  constructor(
    @Inject(deploymentConfig.KEY)
    private readonly deployment: ConfigType<typeof deploymentConfig>,
  ) {}

  private statusFor(spec: SecretSpec, env: NodeJS.ProcessEnv): SecretStatus {
    const raw = env[spec.name] ?? '';
    const isPlaceholder = raw.length > 0 && isDevPlaceholderSecret(raw);
    const present = raw.length > 0 && !isPlaceholder;
    const meetsLength = spec.minLength === undefined || raw.length >= spec.minLength;
    return {
      name: spec.name,
      purpose: spec.purpose,
      requirement: spec.requirement,
      present,
      valid: present && meetsLength,
      isPlaceholder,
    };
  }

  /** Presence/validity of every catalogued secret. Values never included. */
  secretStatuses(env: NodeJS.ProcessEnv = process.env): SecretStatus[] {
    return SECRET_CATALOG.map((spec) => this.statusFor(spec, env));
  }

  /**
   * Stable hash of non-secret config — lets a deploy detect that the running
   * config differs from what it shipped with (config drift / audit).
   */
  fingerprint(env: NodeJS.ProcessEnv = process.env): string {
    const material = NON_SECRET_KEYS.map((k) => `${k}=${env[k] ?? ''}`).join('\n');
    return createHash('sha256').update(material).digest('hex').slice(0, 16);
  }

  /** Aggregate config-health report (safe to expose to admins). */
  report(env: NodeJS.ProcessEnv = process.env): ConfigHealthReport {
    const environment = this.deployment.environment;
    const isProtected = isProtectedEnvironment(environment);
    const secrets = this.secretStatuses(env);
    const issues: string[] = [];

    for (const s of secrets) {
      const requiredHere =
        s.requirement === 'always' || (s.requirement === 'protected' && isProtected);
      if (requiredHere && !s.present) {
        issues.push(`${s.name} is required in "${environment}" but is missing`);
      }
      if (s.isPlaceholder && isProtected) {
        issues.push(`${s.name} is a dev placeholder — not allowed in "${environment}"`);
      }
      if (s.present && !s.valid) {
        issues.push(`${s.name} is present but fails validation (too short/invalid)`);
      }
    }

    // `error` if any required secret is missing/invalid on a protected tier;
    // `degraded` if only optional secrets are unset; `ok` otherwise.
    const hasHardIssue = issues.length > 0 && isProtected;
    const optionalGaps = secrets.some((s) => s.requirement === 'optional' && !s.present);
    const status: ConfigHealthStatus = hasHardIssue ? 'error' : optionalGaps ? 'degraded' : 'ok';

    return {
      status,
      environment,
      protectedEnvironment: isProtected,
      configVersion: this.deployment.configVersion,
      checkedAt: new Date().toISOString(),
      fingerprint: this.fingerprint(env),
      secrets,
      issues,
    };
  }
}
