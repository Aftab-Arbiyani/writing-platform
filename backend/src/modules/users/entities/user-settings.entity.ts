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

  /**
   * B5 (docs/45 §4.10) — the author's own "turn AI off" switch. When `false` the
   * server REFUSES every AI request this user makes (`AI_DISABLED_BY_USER`) and
   * `GET /ai/features` reports everything off, so the clients hide their AI
   * affordances *because the server says so* rather than by a local guess.
   *
   * **Defaults to `true`, and that is load-bearing:** the column is additive with
   * `DEFAULT true`, so every existing row — and every user who has no settings row
   * at all — keeps AI exactly as it was on deploy.
   *
   * **Not the same thing as the `ai_personalization` consent** (`privacy.constants.ts`),
   * and deliberately not merged with it: that consent governs whether the user's work
   * may be used to IMPROVE AI, this switch governs whether the tools are OFFERED to
   * them. A writer may want the assistant without the training, or the reverse, so the
   * two stay independently settable.
   *
   * It governs the USER, not the story: a co-author whose own switch is on may still
   * use AI on a story this user co-authors.
   */
  @Column({ type: 'boolean', default: true })
  aiEnabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
