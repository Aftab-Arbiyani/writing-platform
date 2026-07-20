import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ConsentService } from './consent.service';
import { DataSubjectService } from './data-subject.service';
import { PrivacyController } from './privacy.controller';

/**
 * Privacy Platform (P7.2, GDPR/CCPA-ready). Consent tracking, self-service data
 * export (Art. 15) + erasure (Art. 17), and a data-retention registry. Consent
 * state is durable Redis (@Global RedisModule); every consent + DSR event is
 * recorded immutably via the @Global SecurityAuditService (audit_logs is SSOT).
 * `DataSubjectService` is exported so modules can self-register a
 * PrivacyDataContributor to join export/erasure, and so the Compliance Platform
 * can read consent/DSR state. No new tables — reuses Redis + the audit trail.
 */
@Module({
  imports: [AuditModule],
  controllers: [PrivacyController],
  providers: [ConsentService, DataSubjectService],
  exports: [ConsentService, DataSubjectService],
})
export class PrivacyModule {}
