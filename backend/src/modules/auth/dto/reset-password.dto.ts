import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_MAX, PASSWORD_MIN } from '@qalam/shared';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /auth/reset-password` body. The `token` is the single-use, time-boxed
 * reset token from the emailed link; `newPassword` is re-hashed with Argon2id.
 * Flow is Epic 1 t9.
 */
export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use reset token from the emailed link.' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, writeOnly: true })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}
