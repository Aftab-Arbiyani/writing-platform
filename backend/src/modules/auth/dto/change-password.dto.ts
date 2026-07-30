import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_MAX, PASSWORD_MIN } from '@qalam/shared';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /auth/change-password` body (authenticated). Requires the current
 * password (re-auth for a sensitive op); the new password is re-hashed and all
 * other sessions are revoked (docs 13 §3.6).
 */
export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, writeOnly: true })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}
