import { Column, Entity } from 'typeorm';
import type { AiGenerationParams, AiProvider } from '@qalam/shared';

import { QalamBaseEntity } from '../../../../common/base/base.entity';

/**
 * Organization-wide AI defaults (AF1) — a single admin-owned row that overrides
 * the env baseline (`aiConfig`). Every call inherits these unless the user has
 * their own override. Absent row => env baseline is used as-is.
 */
@Entity('ai_org_config')
export class AiOrgConfig extends QalamBaseEntity {
  @Column({ type: 'varchar', length: 40 })
  provider!: AiProvider;

  /** Blank => the registry's default model for `provider`. */
  @Column({ type: 'varchar', length: 120, default: '' })
  model!: string;

  /** Generation params (temperature/topP/maxTokens/penalties/stop). */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  params!: AiGenerationParams;

  @Column({ type: 'boolean', default: true })
  streaming!: boolean;

  /** Provider-agnostic safety knobs (opaque; consumed by safety hooks). */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  safety!: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
