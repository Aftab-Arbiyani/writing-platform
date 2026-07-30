import type {
  AiModelInfo,
  AiOrgDefaults,
  AiProviderInfo,
  UpdateAiOrgDefaultsRequest,
} from '@qalam/api-types';

import { api } from '@/lib/api-client';

/**
 * Admin AI api layer (AF1) — the only place `/admin/ai/*` endpoints are named.
 * Returns already-unwrapped data. API keys are never returned by the backend
 * (providers carry a `configured` boolean only).
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
};
