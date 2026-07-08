import { BeforeInsert, CreateDateColumn, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Base class for **append-only** aggregate rows — a UUIDv7 `id` and `created_at`
 * only, deliberately WITHOUT `updated_at` (docs 04 §1.4: append-only tables never
 * mutate, they are inserted and deleted). Engagement rows with a surrogate PK use
 * it: `likes`, `bookmarks`, `shares`, `responses`, `collection_pieces`.
 *
 * It sits between {@link QalamBaseEntity} (which adds `updated_at`, for mutable
 * rows like `claps`/`collections`) and the raw two-column joins (`piece_tags`,
 * which have a composite PK and declare their own columns). Same UUIDv7
 * `@BeforeInsert` assignment as the other bases (PG16 has no native v7, §1.2).
 */
export abstract class QalamAppendOnlyEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Assigns the application-generated UUIDv7 primary key on first insert. */
  @BeforeInsert()
  protected assignId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
