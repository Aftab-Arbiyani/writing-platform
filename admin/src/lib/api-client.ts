import { env } from '@/config/env';

/**
 * The admin panel's single, typed `fetch` wrapper (docs/32 §1–§5; ADR §6 freezes fetch — axios is
 * not a workspace dependency). No ad-hoc fetch in components: feature `api/` hooks call `api.*` with
 * response types from `@qalam/api-types`. Admin endpoints mount under `/api/v1/admin/*`.
 *
 * Envelope (ADR §5): `{ success:true, data, meta }` | `{ success:false, error:{ code,message,… } }`.
 * Admin returns `{ data, meta }` (tables need `meta.pagination.total` — docs/32 §7.3 offset model).
 *
 * Auth (docs/32 §3): the access token lives in JS memory only (never localStorage); the refresh
 * token rides in an httpOnly cookie (`credentials:'include'`). A 401 with `AUTH_TOKEN_EXPIRED`
 * triggers a SINGLE-FLIGHT refresh + one retry; other auth codes / a failed refresh end the session
 * via the registered unauthorized handler. 403 is never retried.
 */

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiMeta {
  pagination?: ApiPagination;
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

/** Thrown for any non-success response; branch on `.code` (from `@qalam/shared` ERROR_CODES), never `.message`. */
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

// ── Auth token (in-memory only; docs/32 §3) ──────────────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Registered by app/providers — invoked when the session is terminally unauthorized. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// ── Request plumbing ─────────────────────────────────────────────────────────

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
  // Second arg lets VITE_API_URL be relative (e.g. '/api/v1' behind the dev proxy).
  const url = new URL(`${base}${suffix}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function parseEnvelope<T>(response: Response): Promise<ApiResult<T>> {
  if (response.status === 204) return { data: undefined as T, meta: undefined };

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(response.status, {
      code: 'API_MALFORMED_RESPONSE',
      message: `Expected a JSON envelope, got HTTP ${response.status}`,
    });
  }

  if (!envelope.success) throw new ApiError(response.status, envelope.error);
  if (!response.ok) {
    throw new ApiError(response.status, {
      code: 'API_UNEXPECTED_STATUS',
      message: `Success envelope with unexpected HTTP ${response.status}`,
    });
  }
  return { data: envelope.data, meta: envelope.meta };
}

function sendOnce(method: HttpMethod, path: string, options: RequestOptions): Promise<Response> {
  const hasBody = options.body !== undefined;
  return fetch(buildUrl(path, options.query), {
    method,
    // Refresh cookie rides along (docs/32 §3).
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    body: hasBody ? JSON.stringify(options.body) : null,
    signal: options.signal ?? null,
  });
}

// ── Single-flight refresh (docs/32 §3.2) ─────────────────────────────────────

interface RefreshData {
  accessToken: string;
}

let refreshInFlight: Promise<boolean> | null = null;

/** One shared refresh promise — concurrent 401s must not race the rotating refresh token. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return false;
      const { data } = await parseEnvelope<RefreshData>(response);
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Only an expired access token is refreshable; invalid/revoked/reused end the session. */
const REFRESHABLE_CODE = 'AUTH_TOKEN_EXPIRED';

async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  let response = await sendOnce(method, path, options);

  if (response.status === 401 && !path.startsWith('/auth/')) {
    // Peek the code without consuming the body we still need on the happy path.
    let code = '';
    try {
      const body = (await response.clone().json()) as Partial<ApiFailureEnvelope>;
      code = body.error?.code ?? '';
    } catch {
      /* non-JSON 401 — fall through to terminal handling */
    }

    if (code === REFRESHABLE_CODE && (await refreshSession())) {
      response = await sendOnce(method, path, options); // retry once with the fresh token
    } else {
      setAccessToken(null);
      onUnauthorized?.();
    }
  }

  return parseEnvelope<T>(response);
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
