import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiConfigResponse,
  AiConversationDetail,
  AiConversationSummary,
  AiFeaturesResponse,
  AiModelInfo,
  AiStreamEvent,
  AiUsageResponse,
  CreateAiConversationRequest,
  UpdateAiUserOverridesRequest,
} from '@qalam/api-types';

import { del, get, getPage, patch, post, stream } from '@/lib/api-client';
import type { CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

/**
 * AI api layer (AF1) — the only place AI endpoints are named. Thin wrappers over
 * the central api-client (auth, envelope, errors, cancellation all handled there).
 * The client never calls a provider; everything routes through the backend.
 */
export const aiApi = {
  features: (signal?: AbortSignal): Promise<AiFeaturesResponse> =>
    get<AiFeaturesResponse>('/ai/features', { signal }),

  models: (signal?: AbortSignal): Promise<AiModelInfo[]> =>
    get<AiModelInfo[]>('/ai/models', { signal }),

  getConfig: (signal?: AbortSignal): Promise<AiConfigResponse> =>
    get<AiConfigResponse>('/ai/config', { signal }),

  updateConfig: (payload: UpdateAiUserOverridesRequest): Promise<AiConfigResponse> =>
    patch<AiConfigResponse>('/ai/config', payload),

  usage: (signal?: AbortSignal): Promise<AiUsageResponse> =>
    get<AiUsageResponse>('/ai/usage/me', { signal }),

  listConversations: (args: {
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<CursorPage<AiConversationSummary>> =>
    getPage<AiConversationSummary>(
      `/ai/conversations${buildQueryString({ cursor: args.cursor, limit: args.limit })}`,
      { signal: args.signal },
    ),

  getConversation: (id: string, signal?: AbortSignal): Promise<AiConversationDetail> =>
    get<AiConversationDetail>(`/ai/conversations/${encodeURIComponent(id)}`, { signal }),

  createConversation: (payload: CreateAiConversationRequest): Promise<AiConversationSummary> =>
    post<AiConversationSummary>('/ai/conversations', payload),

  deleteConversation: (id: string): Promise<void> =>
    del(`/ai/conversations/${encodeURIComponent(id)}`),

  complete: (payload: AiCompletionRequest): Promise<AiCompletionResponse> =>
    post<AiCompletionResponse>('/ai/completions', payload),

  /** Streamed completion — yields the AF1 SSE events. Pass `init.signal` to cancel. */
  stream: (payload: AiCompletionRequest, init?: RequestInit): AsyncGenerator<AiStreamEvent> =>
    stream<AiStreamEvent>('/ai/completions/stream', payload, init),
};
