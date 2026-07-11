import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * An internal moderator note on a report — visible only to staff, never to the
 * reporter or subject. Append-only in practice (notes are not edited/deleted).
 */
@Entity('report_notes')
@Index('idx_report_notes_report', ['reportId', 'createdAt'])
export class ReportNote extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  reportId!: string;

  /** The moderator who wrote the note. */
  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'text' })
  body!: string;
}
