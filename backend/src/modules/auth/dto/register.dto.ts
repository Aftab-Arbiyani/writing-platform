import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  PEN_NAME_MAX,
  PEN_NAME_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_REGEX,
} from '@qalam/shared';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /auth/register` body (docs 05 §11.1). Contract + validation only — the
 * registration flow (email verification, Argon2id, username claim) is Epic 1.
 *
 * `username` is validated against the shared `USERNAME_REGEX` here; its
 * **permanence** is a persistence-layer invariant (no update path is ever
 * built — ADR §4), not a DTO concern.
 */
export class RegisterDto {
  @ApiProperty({ example: 'meera@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, writeOnly: true })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password!: string;

  @ApiProperty({
    example: 'meera_k',
    minLength: USERNAME_MIN,
    maxLength: USERNAME_MAX,
    description: 'Permanent, lowercase, URL-safe. Cannot be changed after registration.',
  })
  @IsString()
  @Matches(USERNAME_REGEX, { message: 'username must match ^[a-z0-9_]{3,30}$' })
  username!: string;

  @ApiProperty({ example: 'Meera', minLength: PEN_NAME_MIN, maxLength: PEN_NAME_MAX })
  @IsString()
  @Length(PEN_NAME_MIN, PEN_NAME_MAX)
  penName!: string;
}
