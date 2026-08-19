import type {
  AiModelInfo,
  AiOrgDefaults,
  AiProviderInfo,
  RetrievalAdminConfig,
  SearchAnalytics,
  UpdateAiOrgDefaultsRequest,
  UpdateRetrievalAdminConfig,
} from '@qalam/api-types';

import { api } from '@/lib/api-client';

/**
 * Admin AI api layer (AF1 + AF4) — the only place `/admin/ai/*` endpoints are named.
 * Returns already-unwrapped data. API keys are never returned by the backend
 * (providers carry a `configured` boolean only).
 *
 * The retrieval pair (A3) lives here rather than in a feature of its own precisely because of
 * that invariant: `AdminRetrievalController` is mounted on `admin/ai` and carries the same
 * `ai.manage` permission, so a second module naming those paths would be the duplication this
 * file exists to prevent.
 */
export const aiApi = {
  getConfig: (signal?: AbortSignal): Promise<AiOrgDefaults> =>
    api.get<AiOrgDefaults>('/admin/ai/config', { signal }).then((r) => r.data),

  updateConfig: (payload: UpdateAiOrgDefaultsRequest): Promise<AiOrgDefaults> =>
    api.put<AiOrgDefaults>('/admin/ai/config', payload).then((r) => r.data),

  providers: (signal?: AbortSignal): Promise<AiProviderInfo[]> =>
    api.get<AiProviderInfo[]>('/admin/ai/providers', { signal }).then((r) => r.data),

  models: (signal?: AbortSignal): Promise<AiModelInfo[]> =>
    api.get<AiModelInfo[]>('/admin/ai/models', { signal }).then((r) => r.data),

  searchConfig: (signal?: AbortSignal): Promise<RetrievalAdminConfig> =>
    api.get<RetrievalAdminConfig>('/admin/ai/search-config', { signal }).then((r) => r.data),

  /** Partial patch: the server merges per key, so an omitted field keeps its stored value. */
  updateSearchConfig: (payload: UpdateRetrievalAdminConfig): Promise<RetrievalAdminConfig> =>
    api.put<RetrievalAdminConfig>('/admin/ai/search-config', payload).then((r) => r.data),

  searchAnalytics: (windowDays: number, signal?: AbortSignal): Promise<SearchAnalytics> =>
    api
      .get<SearchAnalytics>('/admin/ai/search-analytics', { query: { windowDays }, signal })
      .then((r) => r.data),
};
