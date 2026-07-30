import { Column, Entity, Index, Unique } from 'typeorm';
import type { PromptCategory } from '@qalam/shared';

import { QalamBaseEntity } from '../../../../common/base/base.entity';

/**
 * A prompt template version (AF1). Prompts are versioned: one row per (key,
 * version); exactly one version per key is `active` (the one rendered by default).
 * The TypeScript prompt catalogue seeds v1 of each key; admins add new versions
 * and flip `active` without a deploy. `variables` is the declared variable list
 * the renderer validates against.
 */
@Entity('ai_prompt_templates')
@Unique('uq_ai_prompt_key_version', ['key', 'version'])
@Index('idx_ai_prompt_key_active', ['key', 'active'])
export class AiPromptTemplate extends QalamBaseEntity {
  /** Dot-cased template key, e.g. `system.base`. */
  @Column({ type: 'varchar', length: 120 })
  key!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'varchar', length: 20 })
  category!: PromptCategory;

  @Column({ type: 'varchar', length: 500, default: '' })
  description!: string;

  /** The template body with `{{variable}}` placeholders. */
  @Column({ type: 'text' })
  body!: string;

  /** Declared variable names the body may reference. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  variables!: string[];

  /** Whether this is the active version for its key. */
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
