/**
 * Deployment / build-metadata namespace (P7.1). Single source of truth for
 * "what is running where": service identity, version, git sha, build + deploy
 * timestamps, release channel and instance id. Consumed by:
 *   - the structured-log `base` bindings (logger.module.ts),
 *   - the public version endpoint + admin build/release/version views,
 *   - the deployment-event boot log.
 *
 *   constructor(
 *     @Inject(deploymentConfig.KEY)
 *     private readonly deployment: ConfigType<typeof deploymentConfig>,
 *   ) {}
 *
 * Values are injected by the image build / CD pipeline via env (see env.schema.ts
 * "Build / deployment metadata"); everything is optional so local dev and tests
 * boot without a pipeline.
 */
import { hostname } from 'node:os';

import { registerAs } from '@nestjs/config';

/**
 * Version of the *configuration contract* (the env.schema.ts shape), independent
 * of the app version. Bump on any change to required/renamed env vars so a
 * deploy can assert the running config matches what it shipped with. (P7.1
 * "Configuration Versioning".)
 */
export const CONFIG_VERSION = '1.0.0';

/** Process start time — fixed once at module load, used for uptime + boot audit. */
const STARTED_AT = new Date().toISOString();

export const deploymentConfig = registerAs('deployment', () => ({
  serviceName: process.env.SERVICE_NAME ?? 'qalam-backend',
  environment: process.env.NODE_ENV ?? 'development',
  version: process.env.APP_VERSION ?? '0.0.0',
  gitSha: process.env.GIT_SHA ?? '',
  /** Short 7-char sha for display. */
  gitShaShort: (process.env.GIT_SHA ?? '').slice(0, 7),
  buildTime: process.env.BUILD_TIME ?? '',
  buildNumber: process.env.BUILD_NUMBER ?? '',
  releaseChannel: process.env.RELEASE_CHANNEL ?? 'dev',
  deployedAt: process.env.DEPLOYED_AT ?? '',
  /** Stable per-process identity; falls back to hostname+pid outside orchestrators. */
  instanceId: process.env.INSTANCE_ID ?? `${hostname()}:${process.pid}`,
  configVersion: CONFIG_VERSION,
  startedAt: STARTED_AT,
  /**
   * Human release tag, matching the Sentry release convention
   * `qalam-<app>@<sha>` from docs/14. Empty sha → version only.
   */
  get releaseTag(): string {
    const sha = process.env.GIT_SHA ?? '';
    return sha.length > 0
      ? `${process.env.SERVICE_NAME ?? 'qalam-backend'}@${sha.slice(0, 12)}`
      : `${process.env.SERVICE_NAME ?? 'qalam-backend'}@${process.env.APP_VERSION ?? '0.0.0'}`;
  },
}));
