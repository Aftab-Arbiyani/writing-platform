import { AiConversationStatus, AiFeature } from '@qalam/shared';
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
import {
  Archive,
  ArchiveRestore,
  Download,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
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
  useSetConversationStatus,
} from '../hooks/use-ai-conversations';
import { conversationTitle, featureLabel } from '../lib/conversation-labels';
import type { AiConversationSummary } from '../types/ai.types';

/**
 * AI conversations (`/settings/ai/conversations`, W8 C1) — ported from mobile's
 * `ai_conversations_screen`.
 *
 * **Both premises this page was written under have since been fixed, and the page changed with them**
 * (docs/48 §3.21). W8-1 — mobile could never create a conversation — is closed on mobile (`5d055a5`),
 * so "New conversation" is no longer the only way the surface can hold anything; it stays because
 * starting one deliberately is still the clearest entry point. W8-2 — `status:'archived'` persisted
 * and hid nothing — is closed in the backend (`b45ac03`): the list filters by status and defaults to
 * `active`.
 *
 * **So archive is offered now, and it comes with the shelf that makes it reversible.** An archive
 * control without an archived view is a delete with extra steps: the row leaves the list and there is
 * no way back to it. The two ship together, or neither does.
 *
 * Search is a client-side filter over the loaded rows, as it is on mobile: there is no `q` parameter
 * on `ConversationListQueryDto`, and filtering only what has been paged in is honest about that.
 */
export function AiConversationsPage(): ReactElement {
  usePageTitle('AI conversations');
  const toast = useToast();
  const confirm = useConfirm();

  const [shelf, setShelf] = useState<AiConversationStatus>(AiConversationStatus.Active);
  const conversations = useAiConversations(shelf);
  const create = useCreateConversation();
  const rename = useRenameConversation();
  const setStatus = useSetConversationStatus();
  const remove = useDeleteConversation();
  const exportOne = useExportConversation();

  const archivedShelf = shelf === AiConversationStatus.Archived;
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

  /**
   * Archive, or restore from the archive. No confirmation on either: both are reversible by the
   * other, which is exactly what distinguishes this from Delete above — and it is why the archived
   * shelf had to ship in the same change as the control.
   */
  const moveTo = async (
    row: AiConversationSummary,
    status: AiConversationStatus,
  ): Promise<void> => {
    try {
      await setStatus.mutateAsync({ id: row.id, status });
      toast.success(status === AiConversationStatus.Archived ? 'Archived.' : 'Restored.');
    } catch (error) {
      toast.error(
        status === AiConversationStatus.Archived ? 'Couldn’t archive' : 'Couldn’t restore',
        { description: getErrorMessage(error) },
      );
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

      {/*
       * A tablist rather than two buttons: these are two views of one collection, which is what
       * `tablist` means to a screen reader, and it buys arrow-key navigation and the "1 of 2"
       * announcement for free. Switching resets the title filter — it filters only rows paged in, so
       * a needle carried across a shelf change would hide most of the shelf just arrived at.
       *
       * Styled with the underline treatment `billing-history-page.tsx:74` established, NOT with
       * `QButton variant="primary"` for the selected tab. That was the first attempt and the a11y
       * scan refused it: AntD's derived hover background on a primary button is #ab6846, which is
       * 4.37:1 under white — the pre-existing token debt recorded as W8-5, which a selected tab would
       * have put under the pointer every time someone switched shelves. A selected tab is not a
       * primary action anyway.
       */}
      <div
        role="tablist"
        aria-label="Conversation shelf"
        className="border-line flex gap-1 border-b"
      >
        {[
          { status: AiConversationStatus.Active, label: 'Active' },
          { status: AiConversationStatus.Archived, label: 'Archived' },
        ].map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="tab"
            id={`shelf-${tab.status}`}
            aria-selected={shelf === tab.status}
            aria-controls="conversation-list"
            onClick={() => {
              setShelf(tab.status);
              setFilter('');
              setRenamingId(null);
            }}
            className={
              shelf === tab.status
                ? 'text-ink border-accent focus-visible:ring-accent -mb-px min-h-11 border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-2'
                : 'text-ink-secondary hover:text-ink focus-visible:ring-accent -mb-px min-h-11 border-b-2 border-transparent px-3 text-sm outline-none focus-visible:ring-2'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

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
          icon={archivedShelf ? Archive : MessageSquare}
          title={archivedShelf ? 'Nothing archived' : 'No conversations yet'}
          description={
            archivedShelf
              ? 'Archived conversations are kept here, out of the active list, until you restore or delete them.'
              : 'Start one here, or keep a session from the assistant while you write.'
          }
        />
      ) : visible.length === 0 ? (
        <p role="status" className="text-ink-muted text-sm">
          No loaded conversation matches “{filter.trim()}”.
        </p>
      ) : (
        /*
         * The panel is a WRAPPER, not the list itself: `role="tabpanel"` on the `<ul>` overrides its
         * implicit `list` role, which costs a screen reader the item count and set position on every
         * row. Found by the E2E page object, whose `getByRole('list', …)` stopped matching.
         */
        <div id="conversation-list" role="tabpanel" aria-labelledby={`shelf-${shelf}`}>
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
                       * The tag stays, but for a different reason than W8-2 gave it. It is no longer
                       * explaining an archived row that leaked into the default list — the route filters
                       * that out now. It marks the row as archived on a shelf a reader may have arrived
                       * at by browser back or a shared link, where the tab state is not visible.
                       */}
                      {row.status === AiConversationStatus.Archived ? <QTag>Archived</QTag> : null}
                      <div className="flex shrink-0 items-center gap-1">
                        <QButton
                          size="sm"
                          icon={archivedShelf ? ArchiveRestore : Archive}
                          aria-label={`${archivedShelf ? 'Restore' : 'Archive'} ${conversationTitle(row)}`}
                          loading={setStatus.isPending && setStatus.variables?.id === row.id}
                          onClick={() =>
                            void moveTo(
                              row,
                              archivedShelf
                                ? AiConversationStatus.Active
                                : AiConversationStatus.Archived,
                            )
                          }
                        />
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
        </div>
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
