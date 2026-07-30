import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_REGEX,
} from '@qalam/shared';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /auth/register` body. Contract + validation only.
 *
 * `penName` is intentionally absent in E1: it lives on `profiles.pen_name`
 * (docs 04 §3.1), and profiles are E2 (out of scope). `username` is validated
 * against the shared `USERNAME_REGEX`; its **permanence** is a persistence
 * invariant (no update path is ever built — ADR §4), not a DTO concern.
 */
export class RegisterDto {
  @ApiProperty({ example: 'meera@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'meera_k',
    minLength: USERNAME_MIN,
    maxLength: USERNAME_MAX,
    description: 'Permanent, lowercase, URL-safe. Cannot be changed after registration.',
  })
  @IsString()
  @Matches(USERNAME_REGEX, { message: 'username must match ^[a-z0-9_]{3,30}$' })
  username!: string;

  @ApiProperty({
    minLength: PASSWORD_MIN,
    maxLength: PASSWORD_MAX,
    writeOnly: true,
    description: `Length ${PASSWORD_MIN}–${PASSWORD_MAX}; common passwords are rejected.`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password!: string;
}
