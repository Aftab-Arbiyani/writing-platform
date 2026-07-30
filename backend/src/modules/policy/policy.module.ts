import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PolicyCacheService } from './policy-cache.service';
import { PolicyEngineService } from './policy-engine.service';

/**
 * The Policy Engine module (AF6) — the single source of truth for authorization.
 * `@Global` (like `PermissionsModule`) so `PolicyEngineService` is injectable in
 * every feature module without repeated imports. It owns no tables and no
 * controllers: it is pure decision infrastructure. Data-aware inputs arrive via
 * ports that provider modules self-register at bootstrap, so this module has no
 * dependency on Trust / Collaboration / Monetization (no cycles).
 *
 * Depends only on the already-`@Global` `PermissionResolver` (PBAC) and the
 * shared `AuditService` (optional — for logging notable decisions).
 */
@Global()
@Module({
  imports: [AuditModule],
  providers: [PolicyEngineService, PolicyCacheService],
  exports: [PolicyEngineService, PolicyCacheService],
})
export class PolicyModule {}
