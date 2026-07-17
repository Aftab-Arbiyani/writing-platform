import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AiFeature, AiMessageRole, AiTokenUsage } from '@qalam/shared';
import { DataSource, Repository } from 'typeorm';

import type { CursorPayload } from '../../../common/pagination/cursor.util';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';

/** A message to append (ids assigned by the entity @BeforeInsert). */
export interface NewAiMessage {
  conversationId: string;
  role: AiMessageRole;
  content: string;
  usage?: AiTokenUsage | null;
}

/**
 * Persistence for AI conversations + messages (AF1). Owns both of the module's
 * own tables, so it uses injected TypeORM repositories (docs 16 §3.3) plus the
 * DataSource for the delete-cascade transaction. Every read is scoped to the
 * owner by the service; this layer just runs the queries.
 */
@Injectable()
export class ConversationRepository {
  constructor(
    @InjectRepository(AiConversation)
    private readonly conversations: Repository<AiConversation>,
    @InjectRepository(AiMessage) private readonly messages: Repository<AiMessage>,
    private readonly dataSource: DataSource,
  ) {}

  create(userId: string, feature: AiFeature, title: string | null): Promise<AiConversation> {
    return this.conversations.save(
      this.conversations.create({ userId, feature, title, status: 'active', messageCount: 0 }),
    );
  }

  /** The user's own conversation (or null) — no messages. */
  findOwned(userId: string, id: string): Promise<AiConversation | null> {
    return this.conversations.findOne({ where: { id, userId } });
  }

  /** Messages of a conversation, oldest first. */
  listMessages(conversationId: string): Promise<AiMessage[]> {
    return this.messages.find({
      where: { conversationId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /** Cursor page (newest first) of a user's conversations; over-fetches limit+1. */
  list(userId: string, cursor: CursorPayload | null, limit: number): Promise<AiConversation[]> {
    const qb = this.conversations
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .orderBy('c.updated_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(c.updated_at, c.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  save(conversation: AiConversation): Promise<AiConversation> {
    return this.conversations.save(conversation);
  }

  /**
   * Append a message and bump the conversation's counters, atomically. Returns
   * the persisted message.
   */
  async appendMessage(message: NewAiMessage): Promise<AiMessage> {
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(AiMessage, {
          conversationId: message.conversationId,
          role: message.role,
          content: message.content,
          inputTokens: message.usage?.inputTokens ?? null,
          outputTokens: message.usage?.outputTokens ?? null,
          totalTokens: message.usage?.totalTokens ?? null,
        }),
      );
      await manager
        .createQueryBuilder()
        .update(AiConversation)
        .set({ messageCount: () => 'message_count + 1', lastMessageAt: saved.createdAt })
        .where('id = :id', { id: message.conversationId })
        .execute();
      return saved;
    });
  }

  /** Hard-delete a conversation and all its messages, atomically. */
  async deleteWithMessages(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AiMessage, { conversationId: id });
      await manager.delete(AiConversation, { id });
    });
  }
}
