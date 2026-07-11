import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

/**
 * Shared administrative audit trail (docs 13 §11). Owns the append-only
 * `audit_logs` table and exports {@link AuditService} so privileged surfaces
 * (the admin module today; moderation later) can record and read a subject's
 * history without reimplementing it. Exports services only (docs 16 §3.1).
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
