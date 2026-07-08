import { Visibility } from '@qalam/shared';
import { Column, Entity, Index, Unique } from 'typeorm';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/**
 * A user-curated collection of pieces (docs 04 §3.5). Soft-deletable
 * ({@link QalamAuditEntity}) — curated over months, accidental deletion must be
 * recoverable (§1.5). Owner-scoped and private in Phase 1 (E7 scope): reads are
 * owner-only; the `visibility` column is kept for the eventual public-showcase
 * feature but is not browsable yet.
 *
 * `isDefault` marks the auto-created "Favorites" collection (E7 requirement) —
 * exactly one per user (partial unique in the migration); it cannot be renamed
 * or deleted. `pieces_count` is denormalized (docs §7). FK `owner_id` → users
 * **ON DELETE CASCADE** in the migration.
 */
@Entity('collections')
@Unique('uq_collections_owner_slug', ['ownerId', 'slug'])
@Index('idx_collections_owner', ['ownerId', 'createdAt'])
export class Collection extends QalamAuditEntity {
  @Column({ type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'citext' })
  slug!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageKey!: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(Visibility),
    enumName: 'visibility',
    default: Visibility.Private,
  })
  visibility!: Visibility;

  /** The auto-created "Favorites" collection — immutable, one per user. */
  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'integer', default: 0 })
  piecesCount!: number;
}
