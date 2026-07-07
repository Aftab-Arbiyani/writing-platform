import { BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Base class for every Qalam entity. NOT an `@Entity()` itself — domain
 * entities extend it in Phase 1 (`class User extends QalamBaseEntity`).
 *
 * Named `QalamBaseEntity` (not `BaseEntity`) on purpose: TypeORM ships its own
 * `BaseEntity` (the ActiveRecord base), and an accidental import of that one
 * silently changes an entity's persistence model. The prefix removes that trap.
 *
 * Encodes the ADR §4 / docs 04 §1.4 base columns for **mutable** tables:
 * - `id`         — UUIDv7, application-generated (time-ordered → index-friendly,
 *                  unlike v4; PG16 has no native v7). Public URLs use slug/
 *                  username, never ids.
 * - `created_at` / `updated_at` — timestamptz (UTC); camelCase here, mapped to
 *                  snake_case by SnakeNamingStrategy.
 *
 * Soft delete is deliberately NOT here (docs 04 §1.5 — only three aggregates get
 * it). Recoverable aggregates extend {@link QalamAuditEntity} instead;
 * append-only join/event tables that never mutate declare their own narrower
 * columns (they omit `updated_at` per §1.4).
 */
export abstract class QalamBaseEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /** Assigns the application-generated UUIDv7 primary key on first insert. */
  @BeforeInsert()
  protected assignId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
