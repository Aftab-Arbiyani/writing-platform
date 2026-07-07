import { z } from 'zod';

/**
 * Typed, validated client environment (fail-fast at module load, mirroring the
 * backend's Zod-validated env). Only VITE_-prefixed vars are exposed by Vite.
 */
const envSchema = z.object({
  VITE_API_URL: z.string().min(1).default('http://localhost:4000/api/v1'),
  VITE_SENTRY_DSN: z.string().default(''),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`[admin] Invalid environment configuration — ${issues}`);
}

export const env: Env = parsed.data;
