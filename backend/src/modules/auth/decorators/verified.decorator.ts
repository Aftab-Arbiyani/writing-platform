import { UseGuards, applyDecorators } from '@nestjs/common';

import { VerifiedUserGuard } from '../guards/verified-user.guard';

/**
 * Requires a verified email on a route (composes `VerifiedUserGuard`). Use on
 * routes that already run behind `JwtAuthGuard` (the global default). Feature
 * modules apply it to actions that demand a confirmed address; auth itself has
 * none in E1.
 */
export function Verified(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(VerifiedUserGuard));
}
