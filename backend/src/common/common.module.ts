import { Global, Module } from '@nestjs/common';

import { RateLimitGuard } from './guards/rate-limit.guard';

/**
 * Cross-cutting infrastructure shared by every feature module. Global so its
 * exports are injectable everywhere without repeated imports.
 *
 * Provides/exports `RateLimitGuard` for opt-in use (enforcement lands in Epic 1
 * t8; it is intentionally NOT a global guard — see the guard's docs).
 *
 * `RequestIdMiddleware` is registered app-level in `main.ts` via `app.use` (it
 * must run before nestjs-pino, and Express 5's router rejects the `'*'` wildcard
 * that `MiddlewareConsumer.forRoutes` would need for all-routes application).
 * The global exception filter, response interceptor, and validation pipe are
 * likewise registered imperatively in `main.ts` (Phase-0 pattern, unchanged).
 */
@Global()
@Module({
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class CommonModule {}
