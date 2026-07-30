import { Global, Module } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { SecurityAdminController } from './security-admin.controller';
import { registerEncryptionService } from './encrypted-column.transformer';
import { EncryptionService } from './encryption.service';
import { KeyManagementService } from './key-management.service';
import { SecurityAuditService } from './security-audit.service';
import { SecurityPolicyService } from './security-policy.service';
import { SecurityValidationService } from './security-validation.service';
import { SecurityPlatformService } from './security-platform.service';
import { ThreatDetectionService } from './threat-detection.service';

/**
 * The Security Platform (P7.2) — the central point for security policy
 * enforcement across the system. `@Global` so its services (validation,
 * encryption, key management, policy, threat detection, security audit, and the
 * {@link SecurityPlatformService} facade) are injectable everywhere without
 * re-importing — exactly how a cross-cutting security layer should be reached.
 *
 * It composes existing platforms rather than replacing them: `AuditModule`
 * (immutable trail), `SettingsModule` (admin-tunable lockout thresholds),
 * Redis (DB 3, threat/lockout state), and the global `MetricsService` (security
 * counters). Authorization stays in the Policy Engine, premium access in the
 * Entitlement Service, rate limiting in the RateLimitGuard — never duplicated.
 */
@Global()
@Module({
  imports: [AuditModule, SettingsModule],
  controllers: [SecurityAdminController],
  providers: [
    SecurityValidationService,
    KeyManagementService,
    EncryptionService,
    SecurityPolicyService,
    SecurityAuditService,
    ThreatDetectionService,
    SecurityPlatformService,
  ],
  exports: [
    SecurityValidationService,
    KeyManagementService,
    EncryptionService,
    SecurityPolicyService,
    SecurityAuditService,
    ThreatDetectionService,
    SecurityPlatformService,
  ],
})
export class SecurityModule implements OnModuleInit {
  constructor(private readonly encryption: EncryptionService) {}

  /** Wire the DI-less TypeORM encrypted-column transformer to the live service. */
  onModuleInit(): void {
    registerEncryptionService(this.encryption);
  }
}
