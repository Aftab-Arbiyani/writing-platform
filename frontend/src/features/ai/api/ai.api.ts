import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiFeaturesResponse,
  AiModelInfo,
  AiStreamEvent,
} from '@qalam/api-types';

import { get, post, stream } from '@/lib/api-client';

/**
 * AI api layer (AF1) — the only place these endpoints are named. Thin wrappers over the central
 * api-client (auth, envelope, errors, cancellation all handled there). The client never calls a
 * provider; everything routes through the backend.
 *
 * **D5 removed nine methods**, all of which now 404: the six conversation routes (list / get /
 * create / update / delete / export) with the layer that stored them, `GET /ai/usage/me` with the
 * token-usage page, and `GET|PATCH /ai/config` with the per-user model overrides — a control that
 * asked a poet to choose a temperature.
 *
 * The paths keep their `/ai/` prefix deliberately (D5 decision 10). Renaming a wire contract to match
 * user-facing copy would break every shipped client to change a string no writer ever sees.
 */
export const aiApi = {
  features: (signal?: AbortSignal): Promise<AiFeaturesResponse> =>
    get<AiFeaturesResponse>('/ai/features', { signal }),

  models: (signal?: AbortSignal): Promise<AiModelInfo[]> =>
    get<AiModelInfo[]>('/ai/models', { signal }),

  complete: (payload: AiCompletionRequest): Promise<AiCompletionResponse> =>
    post<AiCompletionResponse>('/ai/completions', payload),

  /** Streamed completion — yields the AF1 SSE events. Pass `init.signal` to cancel. */
  stream: (payload: AiCompletionRequest, init?: RequestInit): AsyncGenerator<AiStreamEvent> =>
    stream<AiStreamEvent>('/ai/completions/stream', payload, init),
};
