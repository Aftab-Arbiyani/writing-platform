import { Injectable } from '@nestjs/common';
import { AI_CONVERSATION_MAX_MESSAGES, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@qalam/shared';
import type { AiConversationStatus, AiFeature, AiTokenUsage } from '@qalam/shared';

import { decodeCursor, encodeCursor } from '../../../common/pagination/cursor.util';
import { AiConversationNotFoundException } from '../ai.exceptions';
import type { ProviderMessage } from '../providers/provider.types';
import { ConversationRepository } from './conversation.repository';
import type { AiConversation } from './entities/ai-conversation.entity';
import type { AiMessage } from './entities/ai-message.entity';

/** Cursor page of conversations. */
export interface ConversationPage {
  items: AiConversation[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
}

/** A message to append via the service. */
export interface AppendMessageInput {
  role: ProviderMessage['role'];
  content: string;
  usage?: AiTokenUsage | null;
}

/**
 * AI conversation domain logic (AF1): storage, message history, metadata,
 * continuation (loading prior turns to feed the model), deletion, and export.
 * Every operation is owner-scoped — a foreign/missing id reads as
 * `AI_CONVERSATION_NOT_FOUND` (privacy-preserving). The orchestrator reuses this
 * (via {@link historyFor}/{@link appendMessage}); no feature re-implements
 * conversation handling.
 */
@Injectable()
export class ConversationService {
  constructor(private readonly repo: ConversationRepository) {}

  create(userId: string, feature: AiFeature, title?: string): Promise<AiConversation> {
    return this.repo.create(userId, feature, title ?? null);
  }

  async list(
    userId: string,
    rawCursor: string | undefined,
    rawLimit?: number,
  ): Promise<ConversationPage> {
    const limit = Math.min(Math.max(rawLimit ?? PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
    const rows = await this.repo.list(userId, decodeCursor(rawCursor), limit);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return {
      items,
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && last !== undefined
            ? encodeCursor({ k: last.updatedAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  /** A conversation the user owns, or throws. */
  async getOwnedOrThrow(userId: string, id: string): Promise<AiConversation> {
    const conversation = await this.repo.findOwned(userId, id);
    if (conversation === null) {
      throw new AiConversationNotFoundException();
    }
    return conversation;
  }

  /** A conversation with its full message history. */
  async getDetail(
    userId: string,
    id: string,
  ): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
    const conversation = await this.getOwnedOrThrow(userId, id);
    const messages = await this.repo.listMessages(id);
    return { conversation, messages };
  }

  /**
   * Prior turns as neutral provider messages, for continuation. Trimmed to the
   * most recent {@link AI_CONVERSATION_MAX_MESSAGES} (the orchestrator/context
   * builder does token-budget trimming on top of this).
   */
  async historyFor(conversationId: string): Promise<ProviderMessage[]> {
    const messages = await this.repo.listMessages(conversationId);
    const recent = messages.slice(-AI_CONVERSATION_MAX_MESSAGES);
    return recent.map((message) => ({ role: message.role, content: message.content }));
  }

  appendMessage(conversationId: string, input: AppendMessageInput): Promise<AiMessage> {
    return this.repo.appendMessage({
      conversationId,
      role: input.role,
      content: input.content,
      usage: input.usage ?? null,
    });
  }

  async rename(userId: string, id: string, title: string): Promise<AiConversation> {
    const conversation = await this.getOwnedOrThrow(userId, id);
    conversation.title = title;
    return this.repo.save(conversation);
  }

  async setStatus(
    userId: string,
    id: string,
    status: AiConversationStatus,
  ): Promise<AiConversation> {
    const conversation = await this.getOwnedOrThrow(userId, id);
    conversation.status = status;
    return this.repo.save(conversation);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(userId, id);
    await this.repo.deleteWithMessages(id);
  }

  /** A portable JSON export of a conversation (owner-scoped). */
  async export(userId: string, id: string): Promise<Record<string, unknown>> {
    const { conversation, messages } = await this.getDetail(userId, id);
    return {
      id: conversation.id,
      feature: conversation.feature,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        totalTokens: message.totalTokens,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
}
