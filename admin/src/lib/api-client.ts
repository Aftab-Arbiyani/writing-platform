import { env } from '@/config/env';

/**
 * Foundation API client — the single, typed `fetch` wrapper for the admin
 * panel. No ad-hoc fetches in components; per-feature query hooks call `api.*`
 * with response types from `@qalam/api-types`.
 *
 * Admin endpoints mount under `/api/v1/admin/*` in Phase 1, so feature hooks
 * call e.g. `api.get<UserListResponse>('/admin/users', { query: { page: 1 } })`
 * against the `VITE_API_URL` base (`http://localhost:4000/api/v1` in dev).
 *
 * Every response uses the ADR §5 envelope:
 *   { "success": true,  "data": …, "meta": { … } }
 *   { "success": false, "error": { "code", "message", "details", "requestId" } }
 */

/** Pagination etc. — admin tables use offset pagination (`?page&limit`) per ADR §5. */
export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  cursor?: string | null;
  [key: string]: unknown;
}

interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string;
}

interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

interface ApiFailureEnvelope {
  success: false;
  error: ApiErrorBody;
}

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export interface ApiResult<T> {
  data: T;
  meta: ApiMeta | undefined;
}

/** Thrown for any non-success envelope; carries the catalogue code from @qalam/shared. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];
  readonly requestId: string | undefined;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? [];
    this.requestId = body.requestId;
  }
}

type QueryValue = string | number | boolean | undefined;

interface RequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  const base = env.VITE_API_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  // Second argument lets VITE_API_URL be relative (e.g. '/api/v1' behind the dev proxy).
  const url = new URL(`${base}${suffix}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const hasBody = options.body !== undefined;

  const response = await fetch(buildUrl(path, options.query), {
    method,
    // Auth uses an httpOnly SameSite=Lax cookie (ADR §3) — always send it.
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: hasBody ? JSON.stringify(options.body) : null,
    signal: options.signal ?? null,
  });

  if (response.status === 204) {
    return { data: undefined as T, meta: undefined };
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(response.status, {
      code: 'API_INVALID_RESPONSE',
      message: `Expected a JSON envelope, got HTTP ${response.status}`,
    });
  }

  if (!envelope.success) {
    throw new ApiError(response.status, envelope.error);
  }

  if (!response.ok) {
    throw new ApiError(response.status, {
      code: 'API_UNEXPECTED_STATUS',
      message: `Success envelope with unexpected HTTP ${response.status}`,
    });
  }

  return { data: envelope.data, meta: envelope.meta };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResult<T>> =>
    request<T>('GET', path, options ?? {}),
  post: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResult<T>> =>
    request<T>('DELETE', path, options ?? {}),
};
