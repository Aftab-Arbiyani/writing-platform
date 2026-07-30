import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Curated writing genre (docs 04 §3.3). Reference data — seeded (§9),
 * admin-managed later; never deleted (deactivate via `isActive`). Referenced by
 * profiles (writing genres) now and by pieces later.
 */
@Entity('genres')
export class Genre extends QalamBaseEntity {
  @Index('uq_genres_slug', { unique: true })
  @Column({ type: 'citext' })
  slug!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;
}
