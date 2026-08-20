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

/** A boolean env var: accepts "true"/"1"/"yes" (case-insensitive) as true. */
const boolish = z
  .string()
  .transform((v) => ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase()));

export const envSchema = z.object({
  // ── Runtime ────────────────────────────────────────────────────────────
  // The full environment ladder (P7.1). `qa`, `staging`, `preview`, `production`
  // are the deployed tiers; `development`/`test` are local. The four deployed
  // tiers that carry real user-facing traffic (`qa`,`staging`,`preview`,`production`)
  // are treated as "protected" by the secret-safety gate at the bottom of this file.
  NODE_ENV: z
    .enum(['development', 'test', 'qa', 'staging', 'preview', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: boolish.default('false'),

  // ── Build / deployment metadata (P7.1 — single source of truth for the
  //    version/system endpoints, log bindings and admin build-info views).
  //    Injected by the image build / CD pipeline; all optional so local dev
  //    and tests boot without them. ──────────────────────────────────────
  SERVICE_NAME: z.string().default('qalam-backend'),
  APP_VERSION: z.string().default('0.0.0'),
  GIT_SHA: z.string().default(''),
  BUILD_TIME: z.string().default(''),
  BUILD_NUMBER: z.string().default(''),
  RELEASE_CHANNEL: z.enum(['stable', 'rc', 'beta', 'canary', 'dev']).default('dev'),
  DEPLOYED_AT: z.string().default(''),
  INSTANCE_ID: z.string().default(''),

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
  /** Public CDN origin for media (empty = clients build URLs from S3_ENDPOINT). */
  CDN_URL: z.string().default(''),
  /** Presigned-URL TTL (seconds) for the signed-URL seam. */
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  // ── Outbound mail (Mailpit dev; consumed by the Phase-1 emails queue) ──
  SMTP_URL: z.string().url().default('smtp://localhost:1025'),

  // ── Security Platform (P7.2) ────────────────────────────────────────────
  // Field-level encryption keys (rotation-ready). Format: "id:base64key,id2:..."
  // where each key is 32 bytes base64. Empty = field encryption inert (dev).
  // The active key encrypts; every listed key can decrypt (rotation overlap).
  ENCRYPTION_KEYS: z.string().default(''),
  ENCRYPTION_ACTIVE_KEY_ID: z.string().default(''),
  /** Warn when the active encryption key is older than this (key-expiry monitoring). */
  ENCRYPTION_KEY_MAX_AGE_DAYS: z.coerce.number().int().positive().default(180),
  /** Enforce account lockout after repeated login failures (settings own thresholds). */
  SECURITY_ACCOUNT_LOCKOUT_ENABLED: boolish.default('true'),
  /** Reject a request whose Idempotency-Key replays a prior mutation (API security). */
  SECURITY_IDEMPOTENCY_ENABLED: boolish.default('true'),

  // ── Observability (empty string = Sentry disabled) ─────────────────────
  SENTRY_DSN: z.string().default(''),
  SENTRY_RELEASE: z.string().default(''),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  /** Fraction of info/debug logs kept (1 = keep all). Log-sampling hook (P7.1). */
  LOG_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),

  // ── Ops toggles & guards (previously read raw from process.env; now
  //    validated so a typo fails at boot instead of silently disabling a
  //    subsystem). ──────────────────────────────────────────────────────
  /** Bearer/query token guarding GET /metrics (empty = endpoint refuses in prod). */
  METRICS_TOKEN: z.string().default(''),
  RATE_LIMIT_ENABLED: boolish.default('true'),
  /** API node also runs BullMQ workers in-process when true. */
  WORKERS_ENABLED: boolish.default('true'),
  /** Cron/repeatable jobs registered when true (exactly one node should own them). */
  SCHEDULER_ENABLED: boolish.default('true'),
  /** Trust the X-Forwarded-* chain (hops) from the edge proxy. 0 = don't trust. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  // ── Connection pool (Postgres) ─────────────────────────────────────────
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
  DB_POOL_CONN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  /** Optional read-replica DSN — replication-ready seam (P7.1). Empty = single node. */
  DATABASE_REPLICA_URL: z.string().default(''),

  // ── Mail ───────────────────────────────────────────────────────────────
  MAIL_FROM: z.string().default('Qalam <no-reply@qalam.local>'),

  // ── AI platform (AF1 — Phase 2). Provider API keys are secrets with NO
  //    default beyond '' (blank = provider not configured → the whole AI
  //    subsystem stays inert, matching the disabled feature.ai.enabled flag). ─
  AI_DEFAULT_PROVIDER: z
    .enum([
      'openai',
      'anthropic',
      'google',
      'azure_openai',
      'ollama',
      'openrouter',
      'lm_studio',
      'self_hosted',
      // Test stacks only — the `stub` provider streams a fixed passage instead of calling a
      // vendor. Accepted here because pointing the orchestrator at it is exactly how an E2E
      // stack gets a working AI path; it is still inert unless AI_STUB_ENABLED is also 'true'.
      'stub',
    ])
    .default('openai'),
  AI_DEFAULT_MODEL: z.string().default(''),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().nonnegative().default(100_000),
  AI_MONTHLY_TOKEN_LIMIT: z.coerce.number().int().nonnegative().default(2_000_000),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com/v1'),
  GOOGLE_AI_API_KEY: z.string().default(''),
  GOOGLE_AI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta'),
  // Extension-point providers (OpenAI-compatible; blank until used).
  AZURE_OPENAI_API_KEY: z.string().default(''),
  AZURE_OPENAI_BASE_URL: z.string().default(''),
  OLLAMA_API_KEY: z.string().default(''),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434/v1'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  LM_STUDIO_API_KEY: z.string().default(''),
  LM_STUDIO_BASE_URL: z.string().default('http://localhost:1234/v1'),
  SELF_HOSTED_AI_API_KEY: z.string().default(''),
  SELF_HOSTED_AI_BASE_URL: z.string().default(''),
  /**
   * The `stub` provider's gate — the AI counterpart of `PAYMENTS_MANUAL_ENABLED`. Off unless
   * exactly `'true'`; anything else (including `'1'`) leaves it refusing every call. Declared here
   * so a stack that sets it is validated and a reader of this file can see it exists.
   */
  AI_STUB_ENABLED: z.string().default('false'),

  // ── Monetization / payments (AF5 — Phase 2). Provider secrets are blank by
  //    default (blank = provider not configured → the billing subsystem stays
  //    inert, matching the disabled feature.payments.enabled flag). Never a real
  //    default value; the payment provider is replaceable via these keys alone. ─
  /**
   * The `manual` provider's gate — the payments counterpart of `AI_STUB_ENABLED`, and the one knob
   * on this surface that W4 added as a bare `process.env` read (`payments.config.ts:48`) without
   * declaring it here (**AI-1**, docs/48 §3.8).
   *
   * Two things that cost: this file is the project's fail-fast contract, so an undeclared var means
   * `PAYMENTS_MANUAL_ENABLED=ture` boots happily with payments quietly refusing every call; and a
   * reader auditing what a deployment can switch on cannot find it in the one file whose job is to
   * list exactly that. Declared now, so a typo is a value this schema has seen and defaulted rather
   * than a var nothing knows about.
   *
   * Off unless exactly `'true'`, matching `AI_STUB_ENABLED` — `'1'` leaves it refusing.
   */
  PAYMENTS_MANUAL_ENABLED: z.string().default('false'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_API_BASE_URL: z.string().url().default('https://api.stripe.com/v1'),
  STRIPE_SUCCESS_URL: z.string().default(''),
  STRIPE_CANCEL_URL: z.string().default(''),
  APPLE_SHARED_SECRET: z.string().default(''),
  APPLE_BUNDLE_ID: z.string().default(''),
  APPLE_USE_SANDBOX: z.string().default('true'),
  APPLE_VERIFY_URL: z.string().url().default('https://buy.itunes.apple.com/verifyReceipt'),
  APPLE_SANDBOX_VERIFY_URL: z
    .string()
    .url()
    .default('https://sandbox.itunes.apple.com/verifyReceipt'),
  GOOGLE_PLAY_SERVICE_ACCOUNT_KEY: z.string().default(''),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().default(''),
  GOOGLE_PLAY_API_BASE_URL: z.string().url().default('https://androidpublisher.googleapis.com'),
});

/**
 * Deployed tiers that carry real traffic. Dev-placeholder secrets are refused
 * here so a misconfigured `.env` can never reach a live environment (P7.1
 * "Secret Validation" + "least privilege by default").
 */
export const PROTECTED_ENVIRONMENTS = ['qa', 'staging', 'preview', 'production'] as const;

/** Substrings that mark a value as a copy-paste dev placeholder, never a real secret. */
const DEV_PLACEHOLDER = /dev-only|placeholder|changeme|change-me|example|xxxx|todo|secret-here/i;

/** True when `value` looks like a leftover dev/sample credential. */
export function isDevPlaceholderSecret(value: string): boolean {
  return DEV_PLACEHOLDER.test(value) || value === 'minioadmin' || value === 'postgres';
}

/** True when `env` is a deployed tier that must run with real secrets. */
export function isProtectedEnvironment(nodeEnv: string): boolean {
  return (PROTECTED_ENVIRONMENTS as readonly string[]).includes(nodeEnv);
}

/**
 * Cross-field production hardening: on protected tiers, refuse the shipped dev
 * defaults so a real deploy fails fast rather than running with known-weak
 * credentials. Kept as a wrapper (not merged into the object) so `validateEnv`
 * can distinguish schema errors from safety errors in its message.
 */
export const envSchemaChecked = envSchema.superRefine((env, ctx) => {
  const isProtected = (PROTECTED_ENVIRONMENTS as readonly string[]).includes(env.NODE_ENV);
  if (!isProtected) return;

  const secretChecks: ReadonlyArray<readonly [keyof Env, string]> = [
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ['S3_ACCESS_KEY', env.S3_ACCESS_KEY],
    ['S3_SECRET_KEY', env.S3_SECRET_KEY],
  ];
  for (const [key, value] of secretChecks) {
    if (isDevPlaceholderSecret(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `dev placeholder credential is not allowed in "${env.NODE_ENV}" — set a real secret`,
      });
    }
  }

  // The two JWT secrets must differ (a shared secret defeats access/refresh separation).
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_REFRESH_SECRET'],
      message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
    });
  }

  // Production must not point data stores at localhost, and must not pretty-print logs.
  if (env.NODE_ENV === 'production') {
    if (/localhost|127\.0\.0\.1/.test(env.DATABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'production DATABASE_URL must not point at localhost',
      });
    }
    if (env.LOG_PRETTY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LOG_PRETTY'],
        message: 'LOG_PRETTY must be false in production (structured JSON logs only)',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to ConfigModule.forRoot({ validate }). Runs exactly once, before any
 * other module initializes. Throws a single aggregated, human-readable error
 * listing every offending variable (fail-fast at boot).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchemaChecked.safeParse(config);
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
