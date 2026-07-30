import { Column, Entity, Index } from 'typeorm';
import type { AiGenerationParams, AiProvider } from '@qalam/shared';

import { QalamBaseEntity } from '../../../../common/base/base.entity';

/**
 * A user's personal AI overrides (AF1) — one row per user, all fields optional;
 * unset fields fall back to the org defaults. Lets a user pick their own model /
 * temperature / streaming preference without affecting anyone else.
 */
@Entity('ai_config_overrides')
@Index('uq_ai_config_overrides_user', ['userId'], { unique: true })
export class AiConfigOverride extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  provider!: AiProvider | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model!: string | null;

  /** Partial generation-param overrides merged over org defaults. */
  @Column({ type: 'jsonb', nullable: true })
  params!: AiGenerationParams | null;

  @Column({ type: 'boolean', nullable: true })
  streaming!: boolean | null;
}
