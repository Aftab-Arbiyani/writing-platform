import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../../../common/constants/metadata.constants';

/**
 * Marks a route as public — `JwtAuthGuard` skips authentication for it. Use on
 * the auth endpoints (register/login/refresh) and other unauthenticated routes.
 *
 * ```ts
 * @Public()
 * @Post('login')
 * login() { … }
 * ```
 */
export function Public(): CustomDecorator<string> {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
