/**
 * API response envelope (ADR §5) — every endpoint returns one of these shapes:
 *   { "success": true,  "data": …, "meta": { … } }
 *   { "success": false, "error": { "code", "message", "details", "requestId" } }
 *
 * The discriminant is `success`, so `if (res.success)` narrows the union.
 */
import type { ErrorCode } from './error-codes.js';

/** Cursor pagination — feeds/timelines (opaque base64, stable under insertion). */
export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/** Offset pagination — admin tables that need totals. */
export interface OffsetMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type PaginationMeta = CursorMeta | OffsetMeta;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    /** Stable catalogue code from ERROR_CODES — what clients switch on. */
    code: ErrorCode;
    /** Human-readable; NEVER parse this, it can change and will be localized. */
    message: string;
    /** Field-level validation issues and similar structured context. */
    details?: unknown[];
    /** Correlation ID propagated frontend → API → queue jobs (ADR §9). */
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
