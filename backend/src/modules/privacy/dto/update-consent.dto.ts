import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';

import { ALL_CONSENT_PURPOSES, type ConsentPurpose } from '../privacy.constants';

/** Grant or withdraw one consent purpose (GDPR-aligned, opt-in). */
export class UpdateConsentDto {
  @ApiProperty({ enum: ALL_CONSENT_PURPOSES, example: 'analytics' })
  @IsIn(ALL_CONSENT_PURPOSES)
  purpose!: ConsentPurpose;

  @ApiProperty({ example: true, description: 'true = grant, false = withdraw' })
  @IsBoolean()
  granted!: boolean;
}
