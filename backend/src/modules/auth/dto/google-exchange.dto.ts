import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * `POST /auth/google/exchange` body — the one-time code minted by the OAuth
 * callback, exchanged for an access token (docs 13 §3.4). Validated (was a raw
 * unvalidated body param before Epic 12 hardening).
 */
export class GoogleExchangeDto {
  @ApiProperty({ description: 'One-time code from the Google OAuth callback redirect.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  code!: string;
}
