import { ReportReason } from '@qalam/shared';
import { useMutation } from '@tanstack/react-query';

import { reportsApi } from '@/lib/reports-api';
import type { CreateReportInput } from '@/types/report';

/**
 * Filing a report (W7b, docs/45 §4.4) — one mutation for all four `ReportEntityType`s.
 *
 * App level (docs/26 §4) because its mount points span three features: the reader
 * (`features/reading`), the conversation surfaces W7a put at app level, and the profile
 * (`features/profile`).
 *
 * **Nothing is invalidated on success, and that is correct.** A report creates a moderation record
 * the reporter cannot see again — there is no reporter-facing list of "my reports", the queue is
 * the A-track, and the reported entity does not change. Invalidating anything here would refetch
 * for no reason and imply the content had been acted on.
 */
export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => reportsApi.create(input),
  });
}

/** The maximum `description` length — mirrors `CreateReportDto`'s `@MaxLength(1000)`. */
export const REPORT_DESCRIPTION_MAX = 1000;

/**
 * The reasons offered, in order, with `other` last — the same order mobile's `report_sheet.dart`
 * uses, so a reader who reports on both clients meets the same list in the same sequence.
 */
export const REPORT_REASONS: readonly ReportReason[] = [
  ReportReason.Spam,
  ReportReason.Harassment,
  ReportReason.HateSpeech,
  ReportReason.Violence,
  ReportReason.SexualContent,
  ReportReason.SelfHarm,
  ReportReason.Misinformation,
  ReportReason.Copyright,
  ReportReason.Impersonation,
  ReportReason.Other,
];

/** Human labels for the reason catalogue. Keyed exhaustively so a new reason cannot go unlabelled. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  [ReportReason.Spam]: 'Spam',
  [ReportReason.Harassment]: 'Harassment or bullying',
  [ReportReason.HateSpeech]: 'Hate speech',
  [ReportReason.Violence]: 'Violence or threats',
  [ReportReason.SexualContent]: 'Sexual content',
  [ReportReason.SelfHarm]: 'Self-harm',
  [ReportReason.Misinformation]: 'Misinformation',
  [ReportReason.Copyright]: 'Copyright infringement',
  [ReportReason.Impersonation]: 'Impersonation',
  [ReportReason.Other]: 'Something else',
};
