import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** `POST /auth/verify-email` body — the raw token from the emailed link. */
export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token from the emailed link.' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
