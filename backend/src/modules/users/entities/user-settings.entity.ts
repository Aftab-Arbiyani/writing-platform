import { ThemePreference, Visibility } from '@qalam/shared';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-user preferences — 1:1 satellite of {@link User} (docs 04 §1.3 satellite
 * pattern: PK is the parent id). New table in this epic (documented in docs/04).
 *
 * Holds the DB-only settings the appearance/privacy pages read: theme, a default
 * visibility for future pieces, and a notification-preferences bag (schema now,
 * sending is E9 — docs 18). Account privacy (`is_private`) and compose language
 * live on the profile; this table is the preference bag only.
 */
@Entity('user_settings')
export class UserSettings {
  /** PK = FK → users (ON DELETE CASCADE in migration). */
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: Object.values(ThemePreference),
    enumName: 'theme_preference',
    default: ThemePreference.System,
  })
  theme!: ThemePreference;

  @Column({
    type: 'enum',
    enum: Object.values(Visibility),
    enumName: 'visibility',
    default: Visibility.Public,
  })
  defaultPieceVisibility!: Visibility;

  /** Per-type on/off flags; sending arrives in E9 (docs 18). */
  @Column({ type: 'jsonb', default: {} })
  notificationPreferences!: Record<string, boolean>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
