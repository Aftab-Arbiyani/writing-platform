/** Public surface of the audit module (docs 16 §5.2 — module barrel). */
export { AuditModule } from './audit.module';
export { AuditService } from './audit.service';
export type { AuditContext, RecordAuditInput } from './audit.service';
export { AUDIT_ACTIONS, AUDIT_TARGET, AUDIT_CATEGORY, auditCategoryOf } from './audit.constants';
export type { AuditAction, AuditCategory, AuditTarget } from './audit.constants';
export { AuditLogDto, AuditSummaryDto, AuditQueryDto } from './dto/audit-log.dto';
