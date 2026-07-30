import { Column, Entity, Index } from 'typeorm';
import type { AiConversationStatus, AiFeature } from '@qalam/shared';

import { QalamBaseEntity } from '../../../../common/base/base.entity';

/**
 * An AI conversation (AF1) — a container of messages owned by one user, tagged
 * with the AI feature that started it. Mutable (title/status/counters change);
 * deletion is a hard delete that cascades its messages (in a transaction).
 */
@Entity('ai_conversations')
@Index('idx_ai_conversations_user_updated', ['userId', 'updatedAt'])
export class AiConversation extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  feature!: AiFeature;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: AiConversationStatus;

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;
}
