import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A read session (E10) — recorded on `ReadCompleted` with the reported dwell +
 * scroll completion. Feeds the read/completion aggregates and reader analytics
 * (distinct pieces, favorite genres/languages, streak). Bounded, lower-volume
 * than views. No FK (analytics ingest hot path, docs 04 §3.9).
 */
@Entity('read_event')
@Index('idx_read_event_reader_piece', ['readerId', 'pieceId'])
@Index('idx_read_event_reader', ['readerId', 'createdAt'])
@Index('idx_read_event_piece', ['pieceId'])
export class ReadEvent extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'uuid', nullable: true })
  readerId!: string | null;

  @Column({ type: 'integer', default: 0 })
  durationSeconds!: number;

  @Column({ type: 'integer', default: 0 })
  completionPct!: number;
}
