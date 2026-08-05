import { QButton, QCard, QEmptyState, QSpinner, QTag } from '@qalam/ui';
import { ArrowLeft, Download, MessageSquare, PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { useToast } from '@qalam/ui';

import { useAiConversation, useExportConversation } from '../hooks/use-ai-conversations';
import { ASSISTANT_CONVERSATION_PARAM } from '../hooks/use-assistant-conversation';
import { conversationTitle, featureLabel, roleLabel } from '../lib/conversation-labels';

/**
 * One AI conversation with its full history (`/settings/ai/conversations/:id`, W8 C1) — ported from
 * mobile's `ai_conversation_screen`.
 *
 * Read-only, unlike mobile's, which can also continue the conversation by sending a completion with
 * this `conversationId`. Continuing is left out on purpose: web's assistant lives in the editor
 * (W2), where a completion has the selected prose to work on. A chat box on a settings page would be
 * an assistant with no manuscript in front of it — a second, weaker entry to the same capability.
 *
 * A foreign or missing id reads as `AI_CONVERSATION_NOT_FOUND` by design (the server does not
 * distinguish the two — `conversation.service.ts:65-71`), so this renders one honest not-found state
 * rather than guessing which it was.
 */
export function AiConversationPage(): ReactElement {
  const { conversationId = '' } = useParams<{ conversationId: string }>();
  const conversation = useAiConversation(conversationId);
  const exportOne = useExportConversation();
  const toast = useToast();

  usePageTitle(
    conversation.data === undefined ? 'Conversation' : conversationTitle(conversation.data),
  );

  const download = async (): Promise<void> => {
    try {
      await exportOne.mutateAsync(conversationId);
      toast.success('Export downloaded.');
    } catch (error) {
      toast.error('Couldn’t export', { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={ROUTES.settingsAiConversations}
          className="text-ink-secondary hover:text-ink focus-visible:ring-accent inline-flex items-center gap-1.5 rounded-md text-sm outline-none focus-visible:ring-2"
        >
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
          All conversations
        </Link>
      </div>

      {conversation.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : conversation.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {getErrorMessage(conversation.error)}
          </p>
        </QCard>
      ) : conversation.data === undefined ? null : (
        <>
          <section className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-ink mb-1 font-serif text-xl font-semibold">
                {conversationTitle(conversation.data)}
              </h2>
              <p className="text-ink-secondary text-sm">
                {featureLabel(conversation.data.feature)} · started{' '}
                {formatDateTime(conversation.data.createdAt)}
                {conversation.data.status === 'archived' ? ' · archived' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/*
               * Continuing happens in the editor, not here (W8): a completion needs the manuscript to
               * work on, and this deep link binds the assistant to this conversation so its next turns
               * append to it. A chat box on a settings page would be an assistant with no draft in
               * front of it.
               */}
              <Link
                to={`${ROUTES.write}?${ASSISTANT_CONVERSATION_PARAM}=${encodeURIComponent(conversationId)}`}
                className="text-accent focus-visible:ring-accent inline-flex items-center gap-1.5 rounded-md text-sm outline-none focus-visible:ring-2"
              >
                <PenLine size={15} strokeWidth={1.5} aria-hidden />
                Continue in the editor
              </Link>
              <QButton
                icon={Download}
                loading={exportOne.isPending}
                onClick={() => void download()}
              >
                Export JSON
              </QButton>
            </div>
          </section>

          {conversation.data.messages.length === 0 ? (
            <QEmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Messages appear here once this conversation is used by the assistant."
            />
          ) : (
            <ol aria-label="Messages" className="flex flex-col gap-3">
              {conversation.data.messages.map((message) => (
                <QCard as="li" key={message.id}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-ink text-sm font-medium">{roleLabel(message.role)}</span>
                    <span className="text-ink-muted text-xs">
                      {formatDateTime(message.createdAt)}
                    </span>
                    {/*
                     * Usage is present on assistant messages and null on user/system ones
                     * (`ai.mappers.ts:16-23`), so this is absence, not a missing value to apologize
                     * for — no "—" placeholder.
                     */}
                    {message.usage === null ? null : (
                      <QTag>{message.usage.totalTokens.toLocaleString()} tokens</QTag>
                    )}
                  </div>
                  {/*
                   * `whitespace-pre-wrap`, not a markdown renderer. The stored content is whatever the
                   * provider returned; rendering it as markdown here would let model output decide
                   * this page's markup, and the assistant panel (W2) is where formatted output is
                   * presented under its own controls.
                   */}
                  <p className="text-ink-secondary text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </QCard>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
