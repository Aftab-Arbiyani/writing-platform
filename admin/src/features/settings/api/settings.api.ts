import { api } from '@/lib/api-client';

import type {
  CreateFeatureFlagPayload,
  FeatureFlag,
  Maintenance,
  Setting,
  UpdateFeatureFlagPayload,
  UpdateMaintenancePayload,
  UpdateSettingsPayload,
} from '../types/settings.types';

/**
 * The Settings feature's `api/` layer — the only place `/admin/settings*`,
 * `/admin/feature-flags*`, and `/admin/maintenance` are named (docs 26 §7). All
 * go through the shared api-client (no ad-hoc fetch in components); every call
 * returns already-unwrapped data. Integrates ONLY with the E12.8 endpoints — no
 * mock data.
 */
export const settingsApi = {
  // ── Settings ──────────────────────────────────────────────────────────────
  getAll: (signal?: AbortSignal): Promise<Setting[]> =>
    api.get<Setting[]>('/admin/settings', { signal }).then((r) => r.data),

  getByCategory: (category: string, signal?: AbortSignal): Promise<Setting[]> =>
    api.get<Setting[]>(`/admin/settings/${category}`, { signal }).then((r) => r.data),

  update: (payload: UpdateSettingsPayload): Promise<Setting[]> =>
    api.patch<Setting[]>('/admin/settings', payload).then((r) => r.data),

  updateCategory: (category: string, payload: UpdateSettingsPayload): Promise<Setting[]> =>
    api.patch<Setting[]>(`/admin/settings/${category}`, payload).then((r) => r.data),

  // ── Feature flags ───────────────────────────────────────────────────────────
  listFlags: (signal?: AbortSignal): Promise<FeatureFlag[]> =>
    api.get<FeatureFlag[]>('/admin/feature-flags', { signal }).then((r) => r.data),

  createFlag: (payload: CreateFeatureFlagPayload): Promise<FeatureFlag> =>
    api.post<FeatureFlag>('/admin/feature-flags', payload).then((r) => r.data),

  updateFlag: (id: string, payload: UpdateFeatureFlagPayload): Promise<FeatureFlag> =>
    api.patch<FeatureFlag>(`/admin/feature-flags/${id}`, payload).then((r) => r.data),

  deleteFlag: (id: string): Promise<void> =>
    api.delete<undefined>(`/admin/feature-flags/${id}`).then(() => undefined),

  // ── Maintenance ─────────────────────────────────────────────────────────────
  getMaintenance: (signal?: AbortSignal): Promise<Maintenance> =>
    api.get<Maintenance>('/admin/maintenance', { signal }).then((r) => r.data),

  updateMaintenance: (payload: UpdateMaintenancePayload): Promise<Maintenance> =>
    api.patch<Maintenance>('/admin/maintenance', payload).then((r) => r.data),
};
