import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Abstract base class for every Qalam entity — this is NOT an @Entity()
 * itself; domain entities extend it in Phase 1 (`class User extends
 * QalamBaseEntity`). ADR §4 decisions it encodes:
 *
 * - PKs are UUIDv7 generated in the application (time-ordered → index-friendly,
 *   unlike v4; PG16 has no native v7). Public URLs use slug/username, never ids.
 * - Property names are camelCase; SnakeNamingStrategy maps them to snake_case
 *   columns (createdAt → created_at, …).
 * - deletedAt enables soft delete where the domain needs recoverability
 *   (users, pieces, collections — not join/event tables; those entities may
 *   skip this base or override).
 */
export abstract class QalamBaseEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  /** Assigns the application-generated UUIDv7 primary key on first insert. */
  @BeforeInsert()
  protected assignId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
