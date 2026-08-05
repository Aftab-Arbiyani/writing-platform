import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiConversationExport,
  CreateAiConversationRequest,
  UpdateAiConversationRequest,
} from '@qalam/api-types';

import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';
import { downloadConversationExport } from '../lib/conversation-export';

/** The caller's conversations, newest first (cursor-paginated). */
export function useAiConversations() {
  return useInfiniteQuery({
    queryKey: qk.ai.conversations(),
    queryFn: ({ pageParam, signal }) => aiApi.listConversations({ cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
}

/** One conversation with its message history. */
export function useAiConversation(id: string) {
  return useQuery({
    queryKey: qk.ai.conversation(id),
    queryFn: ({ signal }) => aiApi.getConversation(id, signal),
    enabled: id !== '',
  });
}

export function useCreateConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAiConversationRequest) => aiApi.createConversation(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.ai.conversations() });
    },
  });
}

/**
 * Rename a conversation (W8 C1).
 *
 * Invalidates **both** the list and that conversation's detail: the title is rendered on each, and
 * the detail is not derived from the list page, so refreshing only the list leaves an open detail
 * view showing the old title.
 *
 * Deliberately `title`-only rather than the full `UpdateAiConversationRequest`. The DTO also accepts
 * `status`, but `status: 'archived'` persists **without hiding anything** — the list query has no
 * status predicate (docs/48 §3.12, W8-2) — so an archive affordance would tell the user something
 * untrue. Not W8's to fix; W8's job is not to ship it.
 */
export function useRenameConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => {
      const payload: UpdateAiConversationRequest = { title };
      return aiApi.updateConversation(id, payload);
    },
    onSuccess: (_updated, { id }) => {
      void client.invalidateQueries({ queryKey: qk.ai.conversations() });
      void client.invalidateQueries({ queryKey: qk.ai.conversation(id) });
    },
  });
}

/**
 * Delete a conversation and its messages.
 *
 * Removes the detail cache entry outright rather than invalidating it: the row is gone server-side,
 * so a refetch would 404 (`AI_CONVERSATION_NOT_FOUND`) and surface an error for a deletion that
 * succeeded.
 */
export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: (_void, id) => {
      client.removeQueries({ queryKey: qk.ai.conversation(id) });
      void client.invalidateQueries({ queryKey: qk.ai.conversations() });
    },
  });
}

/**
 * Export a conversation as a downloaded JSON file.
 *
 * A mutation rather than a query even though the route is a GET: it is a user-triggered one-shot with
 * a side effect (a download), and caching it would mean a second export of an unchanged conversation
 * silently re-downloading a stale document. Nothing is invalidated — an export changes no state.
 */
export function useExportConversation() {
  return useMutation<AiConversationExport, Error, string>({
    mutationFn: (id: string) => aiApi.exportConversation(id),
    onSuccess: (document) => {
      downloadConversationExport(document);
    },
  });
}
