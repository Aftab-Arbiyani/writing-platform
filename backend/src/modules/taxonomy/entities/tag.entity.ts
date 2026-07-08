import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * User-created tag (docs 04 §3.3). Created via `#hashtags` in the editor —
 * get-or-create by normalized `slug`. `pieces_count` is a denormalized usage
 * count for tag pages/autocomplete (maintained when engagement/feeds ship).
 */
@Entity('tags')
export class Tag extends QalamBaseEntity {
  @Index('uq_tags_slug', { unique: true })
  @Column({ type: 'citext' })
  slug!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'integer', default: 0 })
  piecesCount!: number;
}
