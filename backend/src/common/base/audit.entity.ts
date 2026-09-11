import { DeleteDateColumn } from 'typeorm';

import { AppBaseEntity } from './base.entity';

/**
 * Base class for **recoverable** aggregates — {@link AppBaseEntity} plus a
 * soft-delete column. Per docs 04 §1.5 soft delete exists only where the domain
 * needs recoverability: `users`, `pieces`, `collections`. Those entities extend
 * this; everything else extends {@link AppBaseEntity} and hard-deletes.
 *
 * `deletedAt` drives TypeORM's `@DeleteDateColumn`: `softRemove`/`softDelete`
 * set it, and the default find behavior excludes rows where it is non-null.
 *
 * Repository caution (docs 04 §11 / 16 §3.3): raw QueryBuilder reads on these
 * tables must add `deleted_at IS NULL` explicitly — the automatic filter only
 * applies to the entity-manager find APIs, not hand-written query builders.
 */
export abstract class AppAuditEntity extends AppBaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
