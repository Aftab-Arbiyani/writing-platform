import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../../common/base/base.entity';

/**
 * A retired AI conversation (AF1) — a container of messages owned by one user.
 *
 * **Nothing reads or writes this table any more.** D5 removed the conversation layer
 * outright: completions are stateless, and the surfaces that needed a thread (Ask My Book,
 * the conversations list) are gone.
 *
 * The file survives only until **Phase C** — see the note on `CreditTransaction` for why
 * deleting an entity ahead of its migration makes the next generated migration emit a
 * surprise `DROP TABLE`. Delete the file and the table in the same commit.
 *
 * `feature` and `status` are plain `string` now. `AiConversationStatus` no longer exists,
 * and `AiFeature` no longer contains several of the values these rows hold (`ask_book`
 * above all) — so narrowing this column to it would be a type that contradicts the table.
 */
@Entity('ai_conversations')
@Index('idx_ai_conversations_user_updated', ['userId', 'updatedAt'])
export class AiConversation extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  feature!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;
}
