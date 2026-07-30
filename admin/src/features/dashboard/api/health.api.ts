import type { HealthStatus } from '@/components/status-indicator';
import { env } from '@/config/env';

import type { SystemHealth } from '../types/dashboard.types';

/**
 * System-health probes. The backend's Terminus health endpoints are PUBLIC and mounted at the API
 * ORIGIN ROOT (no `/api/v1` prefix), so they bypass the shared api-client. We hit them directly and
 * parse defensively: the body may be raw Terminus (`{ status, details }`) or the wrapped envelope
 * (`{ success, data }`), and a 503 (something down) still returns useful `details`. Any failure
 * degrades to a conservative status — it never throws.
 */
interface Terminus {
  details?: Record<string, { status?: string }>;
}

interface ProbeResult {
  ok: boolean;
  details: Record<string, { status?: string }>;
}

function healthUrl(path: string): string {
  // Mirror the api-client's origin resolution: absolute VITE_API_URL → its origin; relative → same origin.
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

async function probe(path: string, signal?: AbortSignal): Promise<ProbeResult> {
  try {
    const response = await fetch(healthUrl(path), {
      headers: { Accept: 'application/json' },
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;
    return { ok: response.ok, details: extractTerminus(body)?.details ?? {} };
  } catch {
    return { ok: false, details: {} };
  }
}

function statusFor(result: ProbeResult, key: string): HealthStatus {
  const status = result.details[key]?.status;
  if (status === 'up') return 'healthy';
  if (status === 'down') return 'critical';
  return result.ok ? 'healthy' : 'critical'; // no per-indicator detail → fall back to overall
}

export const healthApi = {
  /** Parallel liveness + readiness + storage probes → a normalized per-service health map. */
  check: async (signal?: AbortSignal): Promise<SystemHealth> => {
    const [live, ready, storage] = await Promise.all([
      probe('/health/live', signal),
      probe('/health/ready', signal),
      probe('/health/storage', signal),
    ]);
    return {
      api: live.ok ? 'healthy' : 'critical',
      database: statusFor(ready, 'database'),
      redis: statusFor(ready, 'redis'),
      queues: statusFor(ready, 'queues'),
      storage: statusFor(storage, 'storage'),
    };
  },
};
