import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

/**
 * Compliance Platform (P7.2). A thin aggregation layer over the Security, Audit
 * and Privacy platforms that produces compliance reports + the retention
 * registry, and hosts the framework-readiness + legal-hold seams. Stores no new
 * state; duplicates nothing. `SecurityPlatformService` + `SecurityAuditService`
 * are injected from the @Global Security Platform.
 */
@Module({
  imports: [AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
