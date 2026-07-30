import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTOs (docs 16 §3.2 — never return entities raw). These describe the
 * `data` payload; the global `TransformInterceptor` wraps them in the ADR §5
 * envelope `{ success, data }`. `refreshToken` is present only for mobile
 * clients; web clients receive it as an httpOnly cookie (docs 13 §3.3).
 */
export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ example: 'meera_k' })
  username!: string;

  @ApiProperty()
  isEmailVerified!: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;

  @ApiProperty({ description: 'Short-lived JWT (15 min), sent as a Bearer token.' })
  accessToken!: string;

  @ApiProperty({
    required: false,
    description: 'Mobile clients only; web uses an httpOnly cookie.',
  })
  refreshToken?: string;
}

export class TokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ required: false, description: 'Mobile clients only.' })
  refreshToken?: string;
}

export class GoogleExchangeResponseDto {
  @ApiProperty({ description: 'Access token exchanged from the one-time OAuth code.' })
  accessToken!: string;
}
