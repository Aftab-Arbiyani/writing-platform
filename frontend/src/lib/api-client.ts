import { env } from '@/config/env';

/**
 * Foundation API plumbing — the ONLY place `fetch` is called in this app.
 * Per-feature query/mutation hooks (features/<name>/api/*) build on these
 * helpers in Phase 1; no ad-hoc fetches in components (docs/00 §6).
 *
 * Parses the platform envelope (docs/00 §5):
 *   { "success": true,  "data": …, "meta": … }
 *   { "success": false, "error": { "code", "message", "details", "requestId" } }
 */

interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string;
}

interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiFailureEnvelope {
  success: false;
  error: ApiErrorPayload;
}

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown[];
  readonly requestId: string | undefined;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.status = status;
    this.details = payload.details ?? [];
    this.requestId = payload.requestId;
  }
}

/**
 * Core request. `path` is relative to VITE_API_URL (e.g. '/pieces/some-slug').
 * Cookies (httpOnly refresh/access) ride along via credentials: 'include'.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    // No-content responses (e.g. DELETE) have no envelope; callers type T as void.
    return undefined as unknown as T;
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (body === null) {
    throw new ApiError(response.status, {
      code: 'API_MALFORMED_RESPONSE',
      message: `Expected a JSON envelope from ${path} (HTTP ${String(response.status)})`,
    });
  }

  if (!response.ok || !body.success) {
    if (body.success === false) {
      throw new ApiError(response.status, body.error);
    }
    throw new ApiError(response.status, {
      code: 'API_UNEXPECTED_ERROR',
      message: `Request to ${path} failed with HTTP ${String(response.status)}`,
    });
  }

  return body.data;
}

export function get<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: 'GET' });
}

export function post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    method: 'POST',
    body: body === undefined ? null : JSON.stringify(body),
  });
}

export function patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    method: 'PATCH',
    body: body === undefined ? null : JSON.stringify(body),
  });
}

export function del<T = void>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: 'DELETE' });
}
