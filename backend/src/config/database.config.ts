/**
 * Database config namespace — consumed by TypeOrmModule.forRootAsync in
 * app.module.ts. Consumers inject ConfigType<typeof databaseConfig>.
 * Keep in sync with the CLI data source (src/database/data-source.ts).
 */
import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  /** Required — validateEnv() (env.schema.ts) fails the boot if missing. */
  url: process.env.DATABASE_URL as string,
  /** SQL statement logging piggybacks on LOG_LEVEL (debug/trace only). */
  logging: process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace',
}));
