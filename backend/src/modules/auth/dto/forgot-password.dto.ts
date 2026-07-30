import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * `POST /auth/forgot-password` body. Always responds 202 regardless of whether
 * the email exists (no account enumeration); the reset email is queued only for
 * real accounts. Rate-limited per IP + email (docs 05 §8). Flow is Epic 1 t9.
 */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'meera@example.com', format: 'email' })
  @IsEmail()
  email!: string;
}
