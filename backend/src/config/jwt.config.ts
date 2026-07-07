/**
 * JWT + OAuth config namespace — consumed by the Phase-1 auth module
 * (access 15 min + rotating refresh 30 days, ADR §3). Consumers inject
 * ConfigType<typeof jwtConfig>. Secrets are required by validateEnv()
 * (env.schema.ts), hence the safe casts.
 */
import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  /** Empty until Phase 1 auth wires Google OAuth (code + PKCE). */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
}));
