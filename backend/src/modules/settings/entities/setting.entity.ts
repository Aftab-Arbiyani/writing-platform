import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A single platform configuration entry (E12.8) — the generic key-value row that
 * backs the entire System Settings surface. Deliberately schema-flexible: a new
 * setting is a new ROW (seeded from the TS catalogue on boot), never a new
 * column, so AI / Payments / Mobile / Creator-Economy config lands additively
 * without a migration (docs 04 §1.7 — open sets are varchar + a catalogue).
 *
 * The `value` and `default_value` are `jsonb` so one table stores booleans,
 * numbers, strings, arrays, and JSON objects uniformly (docs 04 §1 — jsonb is
 * sanctioned for config; cf. `card_templates.config`). Metadata columns
 * (`data_type`, `validation_rules`, …) travel WITH the row so the admin UI and
 * exports are self-describing.
 *
 * No soft-delete (config is not a recoverability domain, docs 04 §1.5); no FK on
 * `updated_by` (the trail must survive a hard-deleted admin, cf. `audit_logs`).
 */
@Entity('settings')
@Index('idx_settings_category', ['category'])
export class Setting extends QalamBaseEntity {
  /** Dot-cased configuration key, e.g. `platform.name`, `auth.registration.enabled`. */
  @Column({ type: 'varchar', length: 120, unique: true })
  key!: string;

  /** Grouping bucket for the admin UI (`general`, `security`, `content`, …). */
  @Column({ type: 'varchar', length: 40 })
  category!: string;

  /** The current effective value (any JSON-serialisable shape). */
  @Column({ type: 'jsonb' })
  value!: unknown;

  /** Declared value shape: `boolean` | `string` | `number` | `json` | `array` | `enum`. */
  @Column({ type: 'varchar', length: 20 })
  dataType!: string;

  /** The catalogue default — what `value` resets to. */
  @Column({ type: 'jsonb' })
  defaultValue!: unknown;

  /** Type-specific constraints (min/max/enum/regex/maxLength/required). */
  @Column({ type: 'jsonb', default: {} })
  validationRules!: Record<string, unknown>;

  /** Human-readable description for the admin UI. */
  @Column({ type: 'text', default: '' })
  description!: string;

  /** Whether an admin may change it; `false` = infra-managed (env-driven). */
  @Column({ type: 'boolean', default: true })
  editable!: boolean;

  /** Where the value applies: `all` | `production` | `staging` | `development`. */
  @Column({ type: 'varchar', length: 20, default: 'all' })
  environmentScope!: string;

  /** The admin who last changed it; null while still at the catalogue default. */
  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
