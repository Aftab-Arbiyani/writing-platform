/**
 * Zod schema for every backend environment variable (ADR §10).
 *
 * Wired into ConfigModule.forRoot({ validate: validateEnv }) so a misconfigured
 * process dies at boot with one readable error instead of limping into runtime
 * failures. Dev-friendly variables default to the docker-compose values;
 * DATABASE_URL and the JWT secrets are deliberately required.
 */
import { z } from 'zod';

/** e.g. "15m", "30d", "900s" — the format @nestjs/jwt understands. */
const duration = z.string().regex(/^\d+(ms|s|m|h|d)$/, 'expected a duration like "15m" or "30d"');

export const envSchema = z.object({
  // ── Runtime ────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ── Public URLs (APP_URL + ADMIN_URL also form the CORS allowlist;
  //    ADMIN_URL supplements the ADR §10 list for that purpose) ───────────
  APP_URL: z.string().url().default('http://localhost:5173'),
  ADMIN_URL: z.string().url().default('http://localhost:5174'),
  API_URL: z.string().url().default('http://localhost:4000'),

  // ── Data stores — DATABASE_URL has no default on purpose: silently
  //    connecting to the wrong database is worse than failing at boot ─────
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // ── Auth (consumed by the Phase-1 auth module; secrets never default) ──
  JWT_ACCESS_SECRET: z.string().min(32, 'generate with: openssl rand -base64 32'),
  JWT_ACCESS_TTL: duration.default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'generate with: openssl rand -base64 32'),
  JWT_REFRESH_TTL: duration.default('30d'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  // ── Object storage (MinIO dev / S3-R2 prod) ────────────────────────────
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('qalam-media'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),

  // ── Outbound mail (Mailpit dev; consumed by the Phase-1 emails queue) ──
  SMTP_URL: z.string().url().default('smtp://localhost:1025'),

  // ── Observability (empty string = Sentry disabled) ─────────────────────
  SENTRY_DSN: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to ConfigModule.forRoot({ validate }). Runs exactly once, before any
 * other module initializes. Throws a single aggregated, human-readable error
 * listing every offending variable (fail-fast at boot).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) =>
          `  - ${issue.path.length > 0 ? issue.path.join('.') : '(env)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
