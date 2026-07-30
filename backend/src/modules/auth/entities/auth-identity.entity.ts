import { AuthProvider } from '@qalam/shared';
import { Column, Entity, Index, Unique } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * External OAuth identity linked to a {@link User} (docs 04 §3.1, docs 13 §3.5).
 * Password sign-in is NOT stored here (it lives on `users.password_hash`); this
 * table holds only `google` (and, later, `apple`) identities.
 *
 * `userId` is a plain FK column (constraint declared in the migration,
 * ON DELETE CASCADE) rather than a TypeORM relation — the auth module never
 * imports the users repository (docs 16 §3.1 module boundaries); it reads user
 * data through `UsersService`.
 */
@Entity('auth_identities')
@Unique('uq_auth_identities_provider_subject', ['provider', 'providerUserId'])
@Unique('uq_auth_identities_user_provider', ['userId', 'provider'])
export class AuthIdentity extends QalamBaseEntity {
  @Index('idx_auth_identities_user')
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: Object.values(AuthProvider), enumName: 'auth_provider' })
  provider!: AuthProvider;

  /** The provider's stable subject id (Google `sub`). */
  @Column({ type: 'varchar', length: 255 })
  providerUserId!: string;

  /** Email as reported by the provider; may drift from `users.email`. */
  @Column({ type: 'citext', nullable: true })
  email!: string | null;
}
