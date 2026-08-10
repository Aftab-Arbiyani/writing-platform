import { post } from '@/lib/api-client';
import type { CreateReportInput, Report } from '@/types/report';

/**
 * The reporting `api/` boundary (W7b, docs/32 §10) — one endpoint, four entity types.
 *
 * `POST /reports` is the whole surface this row builds. Two neighbours are deliberately absent:
 *
 *   • `POST /reports/:id/appeal` — subject-only (appealing a resolved report against you). The W7
 *     row names "report", not appeals, so it is out of scope and is NOT given a method here; an
 *     unused api method reads like a live path (the W9 lesson about naming an unused one).
 *   • every `/admin/reports*` moderation view — that is the A-track.
 *
 * App level because the four mount points span three features (docs/26 §4).
 */
export const reportsApi = {
  /**
   * POST /reports — file a report against a piece, comment, response or user.
   *
   * Authenticated (global `JwtAuthGuard`, no special permission) and **write-tier rate limited**
   * (`@RateLimit('write')`), which is why a 429 is a state the caller must handle rather than a
   * surprise: a reader filing several reports in a row can legitimately hit it.
   */
  create: (input: CreateReportInput): Promise<Report> => post<Report>('/reports', input),
};
