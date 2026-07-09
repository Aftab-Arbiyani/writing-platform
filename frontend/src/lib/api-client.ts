import { ERROR_CODES } from '@qalam/shared';

import { env } from '@/config/env';

/**
 * The ONLY place `fetch` is called (docs/00 §6, hard-rule #5). Per-feature query/mutation
 * hooks (features/<name>/api/*) build on these helpers; no ad-hoc fetch in components.
 *
 * Owns (docs/32_APIIntegration.md): platform envelope unwrapping, in-memory access token +
 * Bearer header, single-flight 401 refresh + retry-once, request timeout, cancellation
 * pass-through, and normalization of every failure to a typed `ApiError`.
 *
 * We use native fetch, NOT axios — ADR §6 fixes a centralized fetch wrapper (docs/32 §1).
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

/** The single error type the whole app catches. Branch on `.code`, never `.message`. */
export class ApiError extends Error {
  readonly code: string;
  /** HTTP status, or 0 for transport-level failures (offline/network). */
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

const DEFAULT_TIMEOUT_MS = 20_000;

// ── Access token: JS memory only (never localStorage/readable cookie — docs/12 §7). ─────
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

// ── Terminal-unauthorized handler: the app wires this to clear session + redirect. ──────
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function toBody(body: unknown): BodyInit | null {
  if (body === undefined || body === null) return null;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

// ── Single-flight refresh: concurrent 401s await ONE refresh (rotation-safe, docs/32 §3). ─
let refreshPromise: Promise<void> | null = null;
async function refreshSession(): Promise<void> {
  refreshPromise ??= request<{ accessToken: string }>('/auth/refresh', { method: 'POST' })
    .then((data) => {
      setAccessToken(data.accessToken);
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function doRequest<T>(path: string, init: RequestInit, isRetry: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const isFormBody = init.body instanceof FormData;
  if (init.body != null && !isFormBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  // Timeout + caller cancellation, combined into one signal.
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(408, {
        code: 'API_TIMEOUT',
        message: 'The request timed out. Please try again.',
      });
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err; // caller cancelled — not an application error; callers ignore AbortError
    }
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    throw new ApiError(0, {
      code: offline ? 'API_OFFLINE' : 'API_NETWORK_ERROR',
      message: offline ? "You're offline." : 'Could not reach the server.',
    });
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (body === null) {
    throw new ApiError(response.status, {
      code: 'API_MALFORMED_RESPONSE',
      message: `Expected a JSON envelope from ${path} (HTTP ${String(response.status)}).`,
    });
  }

  if (response.ok && body.success) return body.data;

  const payload: ApiErrorPayload =
    body.success === false
      ? body.error
      : {
          code: 'API_UNEXPECTED_ERROR',
          message: `Request to ${path} failed (HTTP ${String(response.status)}).`,
        };

  // 401 + AUTH_TOKEN_EXPIRED → one silent refresh, then replay once (docs/32 §3).
  if (
    response.status === 401 &&
    !isRetry &&
    !path.startsWith('/auth/') &&
    payload.code === ERROR_CODES.AUTH_TOKEN_EXPIRED
  ) {
    try {
      await refreshSession();
    } catch {
      onUnauthorized();
      throw new ApiError(401, payload);
    }
    return doRequest<T>(path, init, true);
  }

  // Any other 401 (invalid/reused/revoked, or a still-401 replay) → drop to login.
  // Exclude `/auth/*`: a failed login/register/refresh is the caller's to handle (bad
  // credentials, an absent boot cookie) and must NOT be read as a live session dying.
  if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized();

  throw new ApiError(response.status, payload);
}

/** Core request. `path` is relative to VITE_API_URL (e.g. '/pieces/abc'). */
export function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return doRequest<T>(path, init, false);
}

export function get<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: 'GET' });
}

export function post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: 'POST', body: toBody(body) });
}

export function patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: 'PATCH', body: toBody(body) });
}

export function del<T = void>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: 'DELETE' });
}

/** Multipart upload (avatars/covers). Field defaults to `file`; never sets Content-Type. */
export function upload<T>(
  path: string,
  file: File,
  fieldName = 'file',
  init?: RequestInit,
): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);
  return request<T>(path, { ...init, method: 'POST', body: form });
}
