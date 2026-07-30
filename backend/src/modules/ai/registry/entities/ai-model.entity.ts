import { Column, Entity, Index, Unique } from 'typeorm';
import type { AiModelAvailability, AiModelCapability, AiProvider } from '@qalam/shared';

import { QalamBaseEntity } from '../../../../common/base/base.entity';

/**
 * A registered AI model (AF1). The TypeScript model catalogue is the source of
 * truth (mirrors the settings catalogue): on boot the registry upserts every
 * catalogue entry as a row, preserving admin overrides (availability, default
 * flag, costs) on re-sync. Admins can flip availability / default / costs
 * without a deploy; adding a brand-new model is a catalogue entry + ship.
 *
 * Cost columns are USD per 1,000,000 tokens (double precision — these are rate
 * estimates for the usage accountant, not ledger money).
 */
@Entity('ai_models')
@Unique('uq_ai_models_provider_model', ['provider', 'modelId'])
@Index('idx_ai_models_provider', ['provider'])
export class AiModel extends QalamBaseEntity {
  /** Provider that serves this model (`AiProvider`). */
  @Column({ type: 'varchar', length: 40 })
  provider!: AiProvider;

  /** Provider-native model id, e.g. `gpt-4o-mini`. */
  @Column({ type: 'varchar', length: 120 })
  modelId!: string;

  @Column({ type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ type: 'int' })
  contextWindow!: number;

  @Column({ type: 'int' })
  maxOutputTokens!: number;

  /** Capability set (`AiModelCapability[]`) — open-ended, so no new column ever. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  capabilities!: AiModelCapability[];

  @Column({ type: 'boolean', default: false })
  supportsStreaming!: boolean;

  @Column({ type: 'boolean', default: false })
  supportsVision!: boolean;

  @Column({ type: 'boolean', default: false })
  supportsJsonMode!: boolean;

  /** USD per 1,000,000 input tokens. */
  @Column({ type: 'double precision', default: 0 })
  inputCostPerMillion!: number;

  /** USD per 1,000,000 output tokens. */
  @Column({ type: 'double precision', default: 0 })
  outputCostPerMillion!: number;

  /** `available` | `preview` | `deprecated` | `disabled`. */
  @Column({ type: 'varchar', length: 20, default: 'available' })
  availability!: AiModelAvailability;

  /** The provider's default model (at most one true per provider). */
  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  /** Admin who last overrode this row; null on the seeded default. */
  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
