import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** One key → new-value pair in a settings update batch. */
export class UpdateSettingItemDto {
  @ApiProperty({ example: 'auth.registration.enabled', description: 'Existing setting key.' })
  @IsString()
  key!: string;

  @ApiProperty({
    description: 'New value; must match the setting’s `dataType` and validation rules.',
    example: false,
  })
  @IsDefined()
  value!: unknown;
}

/**
 * Batch settings update (`PATCH /admin/settings` and `/:category`). Applies every
 * item atomically; the optional `reason` is recorded in the audit trail. Shape
 * (class-validator) is checked here; per-value type/rule validation happens in the
 * service against the catalogue (docs 04 §1 — jsonb needs service validation).
 */
export class UpdateSettingsDto {
  @ApiProperty({ type: [UpdateSettingItemDto], description: 'Settings to change (1–100).' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpdateSettingItemDto)
  updates!: UpdateSettingItemDto[];

  @ApiPropertyOptional({ description: 'Why the change was made (audited).', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
