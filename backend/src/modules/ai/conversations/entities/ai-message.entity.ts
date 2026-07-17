import { Column, Entity, Index } from 'typeorm';
import type { AiMessageRole } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../../common/base/append-only.entity';

/**
 * One message in an AI conversation (AF1) — append-only (messages are never
 * edited). Token counts are populated for assistant messages (from provider
 * usage); null for user/system messages.
 */
@Entity('ai_messages')
@Index('idx_ai_messages_conversation_created', ['conversationId', 'createdAt'])
export class AiMessage extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: AiMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int', nullable: true })
  inputTokens!: number | null;

  @Column({ type: 'int', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'int', nullable: true })
  totalTokens!: number | null;
}
