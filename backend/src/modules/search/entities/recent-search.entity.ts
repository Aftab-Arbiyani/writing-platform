import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A signed-in reader's recent search terms (E8). Per-user history capped at
 * `RECENT_SEARCHES_MAX` (the service trims older rows after each write). The
 * stored `query` is the NORMALIZED, lowercased term (docs 13 §6: NFC + control
 * strip + whitespace collapse + 256 cap), so `(user_id, query)` de-duplicates
 * case/spacing variants of the same search; re-searching a term bumps its
 * `updated_at` (via a find-then-save) to move it to the top of the list.
 *
 * Not soft-deleted — `DELETE /search/recent/:id` and `DELETE /search/recent`
 * hard-delete (this is the user's own transient history, not a recoverable
 * aggregate, docs 04 §1.5). FK `user_id` → users ON DELETE CASCADE lives in the
 * migration; the unique + listing indexes are authored there too (§10).
 */
@Entity('recent_searches')
@Index('uq_recent_searches_user_query', ['userId', 'query'], { unique: true })
@Index('idx_recent_searches_user_recent', ['userId', 'updatedAt'])
export class RecentSearch extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  /** Normalized (trimmed, whitespace-collapsed, lowercased) search text. */
  @Column({ type: 'varchar', length: 256 })
  query!: string;

  /** Which scope the term was searched in (`SearchType` wire value; default `all`). */
  @Column({ type: 'varchar', length: 20, default: 'all' })
  searchType!: string;
}
