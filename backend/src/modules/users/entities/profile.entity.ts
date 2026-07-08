import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Public-facing writer profile — 1:1 with {@link User} (docs 04 §3.1). Not
 * soft-deleted (docs §1.5 restricts soft delete to users/pieces/collections);
 * a deleted account cascades this row away.
 *
 * `userId` is a plain FK column (constraint + `ON DELETE CASCADE` in the
 * migration) — the profile never imports the users repository. Additions beyond
 * docs §3.1 (documented in docs/04 in this epic): `social_links` jsonb.
 * A generated `search_vector` (pen_name + bio) and trigram indexes are added in
 * the migration for search prep — never read through this entity.
 */
@Entity('profiles')
export class Profile extends QalamBaseEntity {
  @Index('uq_profiles_user', { unique: true })
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  penName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bio!: string | null;

  /** S3 object key, never a full URL (bucket/CDN may move) — docs 04 §3.1. */
  @Column({ type: 'text', nullable: true })
  avatarKey!: string | null;

  @Column({ type: 'text', nullable: true })
  coverKey!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  websiteUrl!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location!: string | null;

  /** platform → url map, e.g. { "twitter": "https://…" } (added this epic). */
  @Column({ type: 'jsonb', default: {} })
  socialLinks!: Record<string, string>;

  /** FK → languages (ON DELETE SET NULL in migration); writer's compose default. */
  @Column({ type: 'uuid', nullable: true })
  defaultLanguageId!: string | null;

  /** Private account — enforced in the query layer, not RLS (ADR §4, docs 13 §4.2). */
  @Column({ type: 'boolean', default: false })
  isPrivate!: boolean;

  @Column({ type: 'integer', default: 0 })
  followersCount!: number;

  @Column({ type: 'integer', default: 0 })
  followingCount!: number;

  @Column({ type: 'integer', default: 0 })
  piecesCount!: number;
}
