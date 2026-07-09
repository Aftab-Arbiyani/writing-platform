import { z } from 'zod';

/**
 * Typed, validated environment. Import `env` — never read import.meta.env
 * directly elsewhere. Fails fast at module load with a readable error so a
 * misconfigured build dies at boot, not on the first API call.
 */
const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  // Base URL for media assets (S3/CDN). Responses return storage KEYS, not URLs — the
  // client builds the full URL via lib/media.ts. Empty → fall back to VITE_API_URL origin.
  VITE_CDN_URL: optionalUrl,
  // Empty string (the .env.example default) means "Sentry disabled".
  VITE_SENTRY_DSN: optionalUrl,
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `[qalam] Invalid environment configuration:\n${issues}\n` +
      'Compare your .env against frontend/.env.example.',
  );
}

export const env: Env = parsed.data;
