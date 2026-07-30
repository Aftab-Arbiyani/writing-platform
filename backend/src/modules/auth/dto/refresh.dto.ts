import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * `POST /auth/refresh` body (docs 05 §7, §11.3). Web clients send an empty body
 * and the httpOnly refresh cookie rides along; mobile clients send
 * `{ refreshToken }` — hence optional. The service resolves cookie-or-body.
 */
export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token (mobile clients). Web clients use the httpOnly cookie instead.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
