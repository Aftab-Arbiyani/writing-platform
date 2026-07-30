import type { HealthStatus } from '@/components/status-indicator';

/**
 * Wire + view types for the System / Ops feature (P7.1). Mirror the backend
 * `/admin/system/*` DTOs (`backend/src/infrastructure/monitoring/system.controller.ts`
 * + `backend/src/config/config-inspector.service.ts`) and the public `/version`
 * and `/health/deep` probes. Hand-authored until `@qalam/api-types` covers them —
 * only the fields the views read are declared (extra response fields are ignored
 * by structural typing).
 */

/** `GET /admin/system/info` — full deployment/build/release/runtime identity. */
export interface SystemInfo {
  service: string;
  environment: string;
  build: SystemBuild;
  release: SystemRelease;
  runtime: SystemRuntime;
  config: SystemConfig;
}

export interface SystemBuild {
  version: string;
  commit: string;
  commitShort: string;
  buildTime: string;
  buildNumber: string;
}

export interface SystemRelease {
  channel: string;
  releaseTag: string;
  deployedAt: string;
}

export interface SystemRuntime {
  nodeVersion: string;
  pid: number;
  instanceId: string;
  startedAt: string;
  uptimeSeconds: number;
  workersEnabled: boolean;
  schedulerEnabled: boolean;
}

export interface SystemConfig {
  version: string;
  fingerprint: string;
}

/** Why a secret matters (backend `SecretRequirement`) — drives "absent = error or info". */
export type SecretRequirement = 'always' | 'protected' | 'optional';

/** One secret's presence/validity — NEVER its value (backend `SecretStatus`). */
export interface SecretStatus {
  name: string;
  purpose: string;
  requirement: SecretRequirement;
  present: boolean;
  valid: boolean;
  isPlaceholder: boolean;
}

export type ConfigHealthStatus = 'ok' | 'degraded' | 'error';

/** `GET /admin/system/config-health` — configuration & secret health report. */
export interface ConfigHealth {
  status: ConfigHealthStatus;
  environment: string;
  protectedEnvironment: boolean;
  configVersion: string;
  checkedAt: string;
  fingerprint: string;
  secrets: SecretStatus[];
  issues: string[];
}

/** `GET /version` — public build identity (root-mounted, no `/api/v1` prefix). */
export interface VersionInfo {
  service: string;
  version: string;
  commit: string;
  environment: string;
  releaseChannel: string;
}

/** One dependency in the deep-health snapshot. */
export interface DeepHealthDependency {
  key: string;
  status: HealthStatus;
}

/** Normalized `GET /health/deep` snapshot — overall + per-dependency statuses. */
export interface DeepHealth {
  overall: HealthStatus;
  dependencies: DeepHealthDependency[];
}

/** One warmable cache group (backend `WarmableCacheDto`). */
export interface WarmableCache {
  key: string;
  label: string;
  prefix: string;
}

/** `GET /admin/cache` — cache DB snapshot (backend `CacheStatusDto`). */
export interface CacheStatus {
  keys: number;
  byPrefix: Record<string, number>;
  usedMemory: string | null;
  warmable: WarmableCache[];
}
