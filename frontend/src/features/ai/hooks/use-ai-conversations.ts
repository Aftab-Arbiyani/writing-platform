import { AiConversationStatus } from '@qalam/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiConversationExport,
  CreateAiConversationRequest,
  UpdateAiConversationRequest,
} from '@qalam/api-types';

import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';
import { downloadConversationExport } from '../lib/conversation-export';

/**
 * The caller's conversations on one shelf, newest first (cursor-paginated).
 *
 * The status is part of the query key, not a client-side filter: the route filters server-side and
 * defaults to `active`, so active and archived are two different reads with their own cursors —
 * paging one must not consume the other's pages.
 */
export function useAiConversations(status: AiConversationStatus = AiConversationStatus.Active) {
  return useInfiniteQuery({
    queryKey: qk.ai.conversations(status),
    queryFn: ({ pageParam, signal }) =>
      aiApi.listConversations({ cursor: pageParam, status, signal }),
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
      void client.invalidateQueries({ queryKey: qk.ai.conversationsAll });
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
 * Deliberately `title`-only rather than the full `UpdateAiConversationRequest`, so a rename can never
 * carry a status change it did not intend. Status has its own mutation below — it did not, while
 * archiving hid nothing (W8-2); the list query now filters by status, so it does.
 */
export function useRenameConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => {
      const payload: UpdateAiConversationRequest = { title };
      return aiApi.updateConversation(id, payload);
    },
    onSuccess: (_updated, { id }) => {
      void client.invalidateQueries({ queryKey: qk.ai.conversationsAll });
      void client.invalidateQueries({ queryKey: qk.ai.conversation(id) });
    },
  });
}

/**
 * Archive or restore a conversation (W8-2's client half).
 *
 * **Both shelves are invalidated, and that is the whole point of the mutation.** A status change moves
 * a row from one list to the other, so refreshing only the shelf it left would leave the shelf it
 * joined stale — and on the archived shelf that is the difference between "restored" and "vanished".
 * The detail is invalidated too: it renders the status.
 */
export function useSetConversationStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AiConversationStatus }) => {
      const payload: UpdateAiConversationRequest = { status };
      return aiApi.updateConversation(id, payload);
    },
    onSuccess: (_updated, { id }) => {
      void client.invalidateQueries({ queryKey: qk.ai.conversationsAll });
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
      void client.invalidateQueries({ queryKey: qk.ai.conversationsAll });
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
