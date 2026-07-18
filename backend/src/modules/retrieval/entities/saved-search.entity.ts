import type { RetrievalQueryType } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A user's saved search (AF4). Owner-scoped; unique per (user, name). `storyId` scopes the
 * search to one story graph when set (else it is a library-wide search). Small, additive
 * table — the "Saved Searches" UX surface. Recent searches are NOT here: those reuse the
 * existing E8 search-history (`recent_searches`) via SearchService.
 */
@Entity('saved_searches')
@Index('uq_saved_searches_user_name', ['userId', 'name'], { unique: true })
@Index('idx_saved_searches_user_created', ['userId', 'createdAt'])
export class SavedSearch extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 2000 })
  query!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  queryType!: RetrievalQueryType | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  storyId!: string | null;
}
