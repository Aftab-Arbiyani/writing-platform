import { PieceStatus, Visibility } from '@qalam/shared';
import { Check, Column, Entity, Index } from 'typeorm';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/** SEO override metadata (E4 addition; docs 04 §3.2 didn't enumerate it). */
export interface SeoMetadata {
  title?: string;
  description?: string;
}

/**
 * A written piece (docs 04 §3.2). Soft-deletable ({@link QalamAuditEntity}) —
 * writers delete in frustration and ask for it back (docs §1.5).
 *
 * `content` (TipTap JSON) is the single source of truth (§5); HTML is never
 * stored. `content_text`, `word_count`, `reading_time_seconds` are DERIVED on
 * every content write (service, via @qalam/utils). `slug` is NULL until first
 * publish and then permanent (§1.5). All FK columns are plain (constraints in
 * the migration) so the pieces module doesn't import other modules' entities
 * (docs 16 §3.1). `search_vector` (generated) + `archived_at`/`seo_metadata`
 * (E4 additions) are added in the migration; `search_vector` is never read here.
 *
 * CHECK constraints mirror docs §3.2: a scheduled piece has `scheduled_at`; a
 * published piece has slug + published_at + genre.
 */
@Entity('pieces')
@Check('chk_pieces_scheduled', `status <> 'scheduled' OR scheduled_at IS NOT NULL`)
@Check(
  'chk_pieces_published',
  `status <> 'published' OR (slug IS NOT NULL AND published_at IS NOT NULL AND genre_id IS NOT NULL)`,
)
@Index('idx_pieces_author_status', ['authorId', 'status', 'createdAt'])
@Index('idx_pieces_language', ['languageId', 'publishedAt'])
@Index('idx_pieces_genre', ['genreId', 'publishedAt'])
export class Piece extends QalamAuditEntity {
  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  title!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  subtitle!: string | null;

  @Index('uq_pieces_slug', { unique: true })
  @Column({ type: 'citext', nullable: true })
  slug!: string | null;

  /** Canonical TipTap document (§5). Always set by the service on create. */
  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;

  @Column({ type: 'text', default: '' })
  contentText!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  featuredQuote!: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageKey!: string | null;

  @Column({ type: 'uuid' })
  languageId!: string;

  @Column({ type: 'uuid', nullable: true })
  genreId!: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(PieceStatus),
    enumName: 'piece_status',
    default: PieceStatus.Draft,
  })
  status!: PieceStatus;

  @Column({
    type: 'enum',
    enum: Object.values(Visibility),
    enumName: 'visibility',
    default: Visibility.Public,
  })
  visibility!: Visibility;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  /** Set at FIRST publish, never rewritten (feeds sort on it). */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  wordCount!: number;

  @Column({ type: 'integer', default: 0 })
  readingTimeSeconds!: number;

  @Column({ type: 'jsonb', nullable: true })
  seoMetadata!: SeoMetadata | null;
}
