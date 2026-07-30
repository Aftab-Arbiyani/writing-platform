import { env } from '@/config/env';
import { ApiError, getAccessToken } from '@/lib/api-client';

/**
 * Multipart upload WITH progress. `fetch` has no upload-progress events, so — per docs/32 §6 —
 * progress uploads use `XMLHttpRequest`, but ONLY inside `lib/` (never in a component). This is
 * the sole place XHR is used; everything else goes through `api-client`. It attaches the
 * in-memory Bearer token + credentials and unwraps the same `{ success, data }` envelope into a
 * typed `ApiError`. It does NOT run the 401→refresh interceptor (uploads happen mid-session with
 * a fresh token); a 401 surfaces to the caller.
 */
export interface UploadOptions {
  /** Multipart field name (default `file`). */
  fieldName?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

interface EnvelopeFailure {
  code: string;
  message: string;
  details?: unknown[];
  requestId?: string;
}

export function uploadWithProgress<T>(
  path: string,
  file: File,
  { fieldName = 'file', onProgress, signal }: UploadOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append(fieldName, file);

    xhr.open('POST', `${env.VITE_API_URL}${path}`);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'application/json');
    // Never set Content-Type — the browser sets multipart/form-data; boundary=… itself.

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }

    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
        },
        { once: true },
      );
    }

    xhr.onabort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    xhr.onerror = () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      reject(
        new ApiError(0, {
          code: offline ? 'API_OFFLINE' : 'API_NETWORK_ERROR',
          message: offline ? "You're offline." : 'Could not reach the server.',
        }),
      );
    };
    xhr.onload = () => {
      const body = xhr.response as { success?: boolean; data?: T; error?: EnvelopeFailure } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.success === true) {
        resolve(body.data as T);
        return;
      }
      const payload: EnvelopeFailure = body?.error ?? {
        code: 'API_UNEXPECTED_ERROR',
        message: `Upload to ${path} failed (HTTP ${String(xhr.status)}).`,
      };
      reject(new ApiError(xhr.status, payload));
    };

    xhr.send(form);
  });
}
