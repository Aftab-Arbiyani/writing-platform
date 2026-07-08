import { registerAs } from '@nestjs/config';

/**
 * Auth config namespace (docs 13 §3). Consumers inject
 * `ConfigType<typeof authConfig>`. Secrets/TTLs come from validated env
 * (env.schema.ts); the Argon2id and cookie values are fixed policy, kept here
 * (not hard-coded in services) so tuning is one edit.
 */
export const authConfig = registerAs('auth', () => ({
  // JWT: HS256, separate secrets + TTLs per token type (docs 13 §3.2).
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    issuer: 'qalam',
  },

  // Argon2id parameters (docs 13 §3.1). Above OWASP minimums; encoded in the
  // PHC hash string so raising them later is a lazy re-hash on next login.
  argon2: {
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  },

  // Single-use token lifetimes (Postgres verification/reset tokens).
  verificationTtlHours: 24,
  passwordResetTtlMinutes: 60,

  // OAuth `state`/PKCE nonce lifetime in Redis (docs 13 §3.4).
  oauthStateTtlSeconds: 600,

  // Frontend origin — where the Google callback redirects with a one-time code.
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',

  // Google OAuth (code + PKCE, docs 13 §3.4). Empty in dev until configured.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // Exact-match registered redirect URI, one per environment (docs 13 §3.4).
    callbackUrl: `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1/auth/google/callback`,
  },

  // Web refresh cookie (docs 13 §3.3): httpOnly, Secure (prod), SameSite=Lax,
  // scoped to the auth routes so it never rides on other requests.
  refreshCookie: {
    name: 'qalam_rt',
    path: '/api/v1/auth',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
}));
