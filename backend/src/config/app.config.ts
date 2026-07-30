/**
 * App-level config namespace. Consumers inject the typed shape:
 *
 *   constructor(
 *     @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
 *   ) {}
 *
 * Values come from process.env, already vetted at boot by validateEnv()
 * (config/env.schema.ts). The fallbacks here mirror the schema defaults only
 * because @nestjs/config does not write Zod defaults back into process.env.
 */
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:5174',
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  /** Empty string = Sentry disabled (local dev). */
  sentryDsn: process.env.SENTRY_DSN ?? '',
}));
