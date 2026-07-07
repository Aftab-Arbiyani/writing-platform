import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * `POST /auth/login` body (docs 05 §11.2). Password length is intentionally NOT
 * re-validated on login (an existing credential may predate a policy change);
 * the service returns the same `AUTH_INVALID_CREDENTIALS` whether email or
 * password is wrong (no account enumeration).
 */
export class LoginDto {
  @ApiProperty({ example: 'meera@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
