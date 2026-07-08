import { TextDirection } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Supported content language (docs 04 §3.3). Reference data — seeded (§9),
 * admin-managed later; never deleted (deactivate via `isActive`). `direction`
 * drives the `dir` attribute end-to-end (Urdu = rtl).
 */
@Entity('languages')
export class Language extends QalamBaseEntity {
  @Index('uq_languages_code', { unique: true })
  @Column({ type: 'varchar', length: 10 })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  nameEn!: string;

  @Column({ type: 'varchar', length: 80 })
  nativeName!: string;

  @Column({
    type: 'enum',
    enum: Object.values(TextDirection),
    enumName: 'text_direction',
    default: TextDirection.Ltr,
  })
  direction!: TextDirection;

  @Column({ type: 'varchar', length: 30, nullable: true })
  script!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;
}
