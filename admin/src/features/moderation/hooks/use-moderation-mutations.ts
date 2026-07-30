import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { moderationApi } from '../api/moderation.api';
import type {
  Appeal,
  BulkReportPayload,
  BulkReportResult,
  Report,
  ReportNote,
  ResolvePayload,
} from '../types/moderation.types';

/** Shared invalidation: any moderation mutation refreshes the whole namespace. */
function useInvalidate(): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.moderation.all });
}

/** PATCH /admin/reports/:id/notes/:noteId — edit an internal note. */
export function useUpdateNote(): UseMutationResult<
  ReportNote,
  Error,
  { id: string; noteId: string; body: string }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, noteId, body }) => moderationApi.updateNote(id, noteId, body),
    onSuccess: invalidate,
  });
}

/** DELETE /admin/reports/:id/notes/:noteId — remove an internal note. */
export function useDeleteNote(): UseMutationResult<void, Error, { id: string; noteId: string }> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, noteId }) => moderationApi.deleteNote(id, noteId),
    onSuccess: invalidate,
  });
}

/** PATCH /admin/reports/:id { status: reviewing } — reopen a resolved/dismissed report. */
export function useReopenReport(): UseMutationResult<Report, Error, { id: string }> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id }) => moderationApi.updateReport(id, { status: 'reviewing' }),
    onSuccess: invalidate,
  });
}

export function useAssignReport(): UseMutationResult<
  Report,
  Error,
  { id: string; moderatorId: string }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, moderatorId }) => moderationApi.assign(id, moderatorId),
    onSuccess: invalidate,
  });
}

export function useSetPriority(): UseMutationResult<
  Report,
  Error,
  { id: string; priority: string }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, priority }) => moderationApi.setPriority(id, priority),
    onSuccess: invalidate,
  });
}

export function useEscalateReport(): UseMutationResult<Report, Error, { id: string }> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id }) => moderationApi.escalate(id),
    onSuccess: invalidate,
  });
}

export function useAddNote(): UseMutationResult<ReportNote, Error, { id: string; body: string }> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }) => moderationApi.addNote(id, body),
    onSuccess: invalidate,
  });
}

export function useResolveReport(): UseMutationResult<
  Report,
  Error,
  { id: string; payload: ResolvePayload }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }) => moderationApi.resolve(id, payload),
    onSuccess: invalidate,
  });
}

export function useBulkReports(): UseMutationResult<BulkReportResult, Error, BulkReportPayload> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload) => moderationApi.bulk(payload),
    onSuccess: invalidate,
  });
}

export function useApproveAppeal(): UseMutationResult<
  Appeal,
  Error,
  { id: string; notes?: string }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, notes }) => moderationApi.approveAppeal(id, notes),
    onSuccess: invalidate,
  });
}

export function useRejectAppeal(): UseMutationResult<
  Appeal,
  Error,
  { id: string; notes?: string }
> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, notes }) => moderationApi.rejectAppeal(id, notes),
    onSuccess: invalidate,
  });
}
