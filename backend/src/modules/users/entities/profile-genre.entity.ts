import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A writer's selected writing genres — pure M:N join between profiles and the
 * seeded genres (new in this epic). Composite PK; no `updated_at` (rows are
 * inserted/removed, never mutated). FKs in the migration: `profile_id` →
 * profiles CASCADE, `genre_id` → genres RESTRICT (reference data).
 */
@Entity('profile_genres')
export class ProfileGenre {
  @PrimaryColumn({ type: 'uuid' })
  profileId!: string;

  @Index('idx_profile_genres_genre')
  @PrimaryColumn({ type: 'uuid' })
  genreId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
