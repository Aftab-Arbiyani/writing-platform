import { api } from '@/lib/api-client';

import type {
  ComplianceReport,
  KeyStatusReport,
  RetentionReport,
  SecurityStatus,
} from '../types/security.types';

/**
 * The Security / Compliance / Privacy feature's `api/` layer (P7.2) — the only place its endpoints
 * are named. All four reads go through the shared api-client (Bearer + `{success,data}` envelope
 * unwrap) and require `admin.dashboard` (the server re-checks). Read-only; no secrets or key
 * material ever cross this boundary — status only.
 */
export const securityApi = {
  /** GET /admin/security/status — non-secret posture (controls, lockout + threat policy). */
  getSecurityStatus: (signal?: AbortSignal): Promise<SecurityStatus> =>
    api.get<SecurityStatus>('/admin/security/status', { signal }).then((result) => result.data),

  /** GET /admin/security/keys — rotation policy + per-key non-secret status. */
  getKeyStatuses: (signal?: AbortSignal): Promise<KeyStatusReport> =>
    api.get<KeyStatusReport>('/admin/security/keys', { signal }).then((result) => result.data),

  /** GET /admin/compliance/report — security posture + audit activity + retention + frameworks. */
  getComplianceReport: (signal?: AbortSignal): Promise<ComplianceReport> =>
    api.get<ComplianceReport>('/admin/compliance/report', { signal }).then((result) => result.data),

  /** GET /admin/compliance/retention — frameworks + data-retention registry. */
  getRetention: (signal?: AbortSignal): Promise<RetentionReport> =>
    api
      .get<RetentionReport>('/admin/compliance/retention', { signal })
      .then((result) => result.data),
};
