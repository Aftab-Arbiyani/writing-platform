import { ApiProperty } from '@nestjs/swagger';

import { SETTING_CATEGORIES, SETTING_DATA_TYPES } from '../settings.constants';

/**
 * The strongly-typed wire shape of one setting (E12.8). Internally backed by the
 * generic key-value row; here every metadata field is explicit so the admin UI
 * and exports are self-describing. `value`/`defaultValue` are polymorphic (their
 * shape follows `dataType`).
 */
export class SettingDto {
  @ApiProperty({ example: 'platform.name', description: 'Dot-cased setting key.' })
  key!: string;

  @ApiProperty({ enum: SETTING_CATEGORIES, example: 'general' })
  category!: string;

  @ApiProperty({
    description: 'Current effective value; JSON shape follows `dataType`.',
    example: 'Qalam',
  })
  value!: unknown;

  @ApiProperty({ enum: SETTING_DATA_TYPES, example: 'string' })
  dataType!: string;

  @ApiProperty({ description: 'The value this setting resets to.', example: 'Qalam' })
  defaultValue!: unknown;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Type-specific constraints (min/max/enum/regex/maxLength).',
    example: { minLength: 1, maxLength: 80 },
  })
  validationRules!: Record<string, unknown>;

  @ApiProperty({ example: 'Public platform name.' })
  description!: string;

  @ApiProperty({ description: 'Whether an admin may change it.', example: true })
  editable!: boolean;

  @ApiProperty({ enum: ['all', 'production', 'staging', 'development'], example: 'all' })
  environmentScope!: string;

  @ApiProperty({ nullable: true, description: 'Admin who last changed it (null = default).' })
  updatedBy!: string | null;

  @ApiProperty({ nullable: true, description: 'When it was last changed (ISO 8601).' })
  updatedAt!: string | null;
}
