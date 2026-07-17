import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateAiConversationRequest } from '@qalam/api-types';

import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';

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

export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.ai.conversations() });
    },
  });
}
