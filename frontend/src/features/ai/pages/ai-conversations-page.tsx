import { AiFeature } from '@qalam/shared';
import {
  QButton,
  QCard,
  QEmptyState,
  QInput,
  QSpinner,
  QTag,
  useConfirm,
  useToast,
} from '@qalam/ui';
import { Download, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { aiConversationPath } from '@/lib/routes';

import {
  useAiConversations,
  useCreateConversation,
  useDeleteConversation,
  useExportConversation,
  useRenameConversation,
} from '../hooks/use-ai-conversations';
import { conversationTitle, featureLabel } from '../lib/conversation-labels';
import type { AiConversationSummary } from '../types/ai.types';

/**
 * AI conversations (`/settings/ai/conversations`, W8 C1) — ported from mobile's
 * `ai_conversations_screen`.
 *
 * **Mobile ships this screen and can never fill it.** `createConversation` exists in all three of its
 * layers and has zero UI callers, and the completion route declines to create a conversation it was
 * not given one for (`ai-completion.service.ts:338`), so `GET /ai/conversations` returns an empty page
 * forever — docs/48 §3.12 W8-1. That is why "New conversation" is on this page: without it the port
 * would inherit a surface that cannot populate.
 *
 * **No archive action**, though the DTO accepts `status`. `PATCH status:'archived'` persists and hides
 * nothing — the list query has no status predicate (W8-2) — so the row returns on the next refetch.
 * Offering it would be a control that reports success and does nothing visible.
 *
 * Search is a client-side filter over the loaded rows, as it is on mobile: there is no `q` parameter
 * on `ConversationListQueryDto`, and filtering only what has been paged in is honest about that.
 */
export function AiConversationsPage(): ReactElement {
  usePageTitle('AI conversations');
  const toast = useToast();
  const confirm = useConfirm();

  const conversations = useAiConversations();
  const create = useCreateConversation();
  const rename = useRenameConversation();
  const remove = useDeleteConversation();
  const exportOne = useExportConversation();

  const [filter, setFilter] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const rows: AiConversationSummary[] = (conversations.data?.pages ?? []).flatMap(
    (page) => page.items,
  );
  const needle = filter.trim().toLowerCase();
  const visible =
    needle === ''
      ? rows
      : rows.filter((row) => conversationTitle(row).toLowerCase().includes(needle));

  const startConversation = async (): Promise<void> => {
    try {
      // `writing_assistant` is the one user-facing assistant feature (AiFeature comment,
      // packages/shared/src/ai.ts:87-90) — the specific action is a prompt-template key, never a
      // separate feature — so it is the correct default for a conversation started by hand.
      await create.mutateAsync({ feature: AiFeature.WritingAssistant });
      toast.success('Conversation started.');
    } catch (error) {
      toast.error('Couldn’t start a conversation', { description: getErrorMessage(error) });
    }
  };

  const submitRename = async (id: string): Promise<void> => {
    const title = draftTitle.trim();
    if (title === '') {
      setRenamingId(null);
      return;
    }
    try {
      await rename.mutateAsync({ id, title });
      setRenamingId(null);
      toast.success('Renamed.');
    } catch (error) {
      toast.error('Couldn’t rename', { description: getErrorMessage(error) });
    }
  };

  const deleteOne = async (row: AiConversationSummary): Promise<void> => {
    const ok = await confirm({
      title: 'Delete this conversation?',
      content: 'Its messages are deleted with it. This can’t be undone.',
      okText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success('Deleted.');
    } catch (error) {
      toast.error('Couldn’t delete', { description: getErrorMessage(error) });
    }
  };

  const download = async (row: AiConversationSummary): Promise<void> => {
    try {
      await exportOne.mutateAsync(row.id);
      toast.success('Export downloaded.');
    } catch (error) {
      toast.error('Couldn’t export', { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-ink mb-1 font-serif text-xl font-semibold">AI conversations</h2>
          <p className="text-ink-secondary text-sm">
            Every assistant session you’ve kept, newest first.
          </p>
        </div>
        <QButton
          variant="primary"
          icon={Plus}
          loading={create.isPending}
          onClick={() => void startConversation()}
        >
          New conversation
        </QButton>
      </section>

      {rows.length > 0 ? (
        <QInput
          type="search"
          aria-label="Filter conversations by title"
          placeholder="Filter loaded conversations"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}

      {conversations.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : conversations.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {getErrorMessage(conversations.error)}
          </p>
        </QCard>
      ) : rows.length === 0 ? (
        <QEmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Start one here, or keep a session from the assistant while you write."
        />
      ) : visible.length === 0 ? (
        <p role="status" className="text-ink-muted text-sm">
          No loaded conversation matches “{filter.trim()}”.
        </p>
      ) : (
        <ul aria-label="Conversations" className="flex flex-col gap-2">
          {visible.map((row) => (
            <QCard as="li" key={row.id} padding="none">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                {renamingId === row.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitRename(row.id);
                    }}
                  >
                    <QInput
                      autoFocus
                      aria-label="Conversation title"
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                    />
                    <QButton
                      htmlType="submit"
                      size="sm"
                      variant="primary"
                      loading={rename.isPending}
                    >
                      Save
                    </QButton>
                    <QButton size="sm" onClick={() => setRenamingId(null)}>
                      Cancel
                    </QButton>
                  </form>
                ) : (
                  <>
                    <Link
                      to={aiConversationPath(row.id)}
                      className="focus-visible:ring-accent min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2"
                    >
                      <span className="text-ink block truncate text-sm font-medium">
                        {conversationTitle(row)}
                      </span>
                      <span className="text-ink-muted text-xs">
                        {featureLabel(row.feature)} · {row.messageCount}{' '}
                        {row.messageCount === 1 ? 'message' : 'messages'} ·{' '}
                        {formatDateTime(row.updatedAt)}
                      </span>
                    </Link>
                    {/*
                     * Status is rendered even though there is no archive control, because the server
                     * can still return an archived row (W8-2) and a row that reads identically to an
                     * active one would be unexplainable.
                     */}
                    {row.status === 'archived' ? <QTag>Archived</QTag> : null}
                    <div className="flex shrink-0 items-center gap-1">
                      <QButton
                        size="sm"
                        icon={Pencil}
                        aria-label={`Rename ${conversationTitle(row)}`}
                        onClick={() => {
                          setRenamingId(row.id);
                          setDraftTitle(row.title ?? '');
                        }}
                      />
                      <QButton
                        size="sm"
                        icon={Download}
                        aria-label={`Export ${conversationTitle(row)}`}
                        loading={exportOne.isPending && exportOne.variables === row.id}
                        onClick={() => void download(row)}
                      />
                      <QButton
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        aria-label={`Delete ${conversationTitle(row)}`}
                        onClick={() => void deleteOne(row)}
                      />
                    </div>
                  </>
                )}
              </div>
            </QCard>
          ))}
        </ul>
      )}

      {conversations.hasNextPage ? (
        <div>
          <QButton
            loading={conversations.isFetchingNextPage}
            onClick={() => void conversations.fetchNextPage()}
          >
            Load more
          </QButton>
        </div>
      ) : null}
    </div>
  );
}
