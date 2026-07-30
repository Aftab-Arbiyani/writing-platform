import type { HealthStatus } from '@/components/status-indicator';
import { env } from '@/config/env';
import { api } from '@/lib/api-client';

import type {
  CacheStatus,
  ConfigHealth,
  DeepHealth,
  SystemInfo,
  VersionInfo,
} from '../types/system.types';

/**
 * The System feature's `api/` layer (P7.1) — the only place its endpoints are named. The two admin
 * reads (`/admin/system/info`, `/admin/system/config-health`) and `/admin/cache` go through the
 * shared api-client (Bearer + envelope-unwrap). The `/version` and `/health/deep` probes are
 * root-mounted (no `/api/v1` prefix) and PUBLIC, so — exactly like the dashboard's `health.api` — we
 * fetch the origin directly and parse defensively: the body may be raw Terminus (`{ status, details }`)
 * or the wrapped envelope (`{ success, data }`), and a 503 (something down) still carries useful
 * `details`. Those probes degrade to a conservative result rather than throwing.
 */

// Deep-health dependency keys in display order (mirrors `HealthController.deep()`).
const DEEP_DEPENDENCY_KEYS = [
  'database',
  'redis',
  'queues',
  'storage',
  'config',
  'search',
  'ai',
  'payments',
] as const;

interface Terminus {
  status?: string;
  details?: Record<string, { status?: string }>;
}

/** Mirror the api-client's origin resolution: absolute VITE_API_URL → its origin; relative → same origin. */
function rootUrl(path: string): string {
  const origin = new URL(env.VITE_API_URL, window.location.origin).origin;
  return `${origin}${path}`;
}

function extractTerminus(body: unknown): Terminus | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.data && typeof record.data === 'object') return record.data as Terminus; // enveloped
  if (record.error && typeof record.error === 'object') {
    const details = (record.error as Record<string, unknown>).details;
    if (details && typeof details === 'object') return { details: details as Terminus['details'] };
  }
  if (record.details && typeof record.details === 'object') return record as Terminus; // raw terminus
  return null;
}

function unwrapVersion(body: unknown): VersionInfo | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const source = (
    record.data && typeof record.data === 'object' ? record.data : record
  ) as Partial<VersionInfo>;
  if (typeof source.service !== 'string' || typeof source.version !== 'string') return null;
  return {
    service: source.service,
    version: source.version,
    commit: typeof source.commit === 'string' ? source.commit : '',
    environment: typeof source.environment === 'string' ? source.environment : '',
    releaseChannel: typeof source.releaseChannel === 'string' ? source.releaseChannel : '',
  };
}

export const systemApi = {
  /** GET /admin/system/info — deployment/build/release/runtime identity (requires `admin.dashboard`). */
  getSystemInfo: (signal?: AbortSignal): Promise<SystemInfo> =>
    api.get<SystemInfo>('/admin/system/info', { signal }).then((result) => result.data),

  /** GET /admin/system/config-health — secret presence/validity, never values (requires `admin.dashboard`). */
  getConfigHealth: (signal?: AbortSignal): Promise<ConfigHealth> =>
    api.get<ConfigHealth>('/admin/system/config-health', { signal }).then((result) => result.data),

  /** GET /admin/cache — cache DB snapshot (requires `admin.dashboard`). */
  getCache: (signal?: AbortSignal): Promise<CacheStatus> =>
    api.get<CacheStatus>('/admin/cache', { signal }).then((result) => result.data),

  /** GET /version (root, public) — public build identity. Returns null on any failure. */
  version: async (signal?: AbortSignal): Promise<VersionInfo | null> => {
    try {
      const response = await fetch(rootUrl('/version'), {
        headers: { Accept: 'application/json' },
        signal,
      });
      if (!response.ok) return null;
      const body = (await response.json().catch(() => null)) as unknown;
      return unwrapVersion(body);
    } catch {
      return null;
    }
  },

  /** GET /health/deep (root, public) — normalized per-dependency snapshot. Never throws. */
  deepHealth: async (signal?: AbortSignal): Promise<DeepHealth> => {
    let ok = false;
    let terminus: Terminus | null = null;
    try {
      const response = await fetch(rootUrl('/health/deep'), {
        headers: { Accept: 'application/json' },
        signal,
      });
      ok = response.ok;
      const body = (await response.json().catch(() => null)) as unknown;
      terminus = extractTerminus(body);
    } catch {
      ok = false;
    }

    const details = terminus?.details ?? {};
    const hasDetails = Object.keys(details).length > 0;
    const overall: HealthStatus =
      ok || terminus?.status === 'ok' ? 'healthy' : hasDetails ? 'critical' : 'unknown';

    const dependencies = DEEP_DEPENDENCY_KEYS.map((key) => {
      const status = details[key]?.status;
      const normalized: HealthStatus =
        status === 'up' ? 'healthy' : status === 'down' ? 'critical' : 'unknown';
      return { key, status: normalized };
    });

    return { overall, dependencies };
  },
};
