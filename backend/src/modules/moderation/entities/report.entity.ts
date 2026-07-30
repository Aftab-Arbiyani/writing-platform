import type {
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportResolution,
  ReportSeverity,
  ReportStatus,
} from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A user report against a piece, comment, response, or user (Moderation module).
 * Polymorphic target (`entityType`/`entityId`); `reportedUserId` denormalizes the
 * offending account (content author or the reported user) so the queue can filter
 * "reported users" and moderation actions have a subject without a second lookup.
 *
 * Enum-ish columns are `varchar` validated by DTOs (`@IsEnum`) — no native PG enum
 * types, so adding a reason/priority never needs a type migration (cf.
 * `notifications.type`). FKs are omitted deliberately: the trail must outlive a
 * hard-deleted target/reporter (moderation records are evidence).
 */
@Entity('reports')
@Index('idx_reports_status_priority', ['status', 'priority', 'createdAt'])
@Index('idx_reports_entity', ['entityType', 'entityId'])
@Index('idx_reports_reported_user', ['reportedUserId'])
@Index('idx_reports_assignee', ['assignedModeratorId'])
export class Report extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  reporterId!: string;

  @Column({ type: 'varchar', length: 20 })
  entityType!: ReportEntityType;

  @Column({ type: 'uuid' })
  entityId!: string;

  /** The offending account (content author, or the reported user itself). */
  @Column({ type: 'uuid', nullable: true })
  reportedUserId!: string | null;

  @Column({ type: 'varchar', length: 30 })
  reason!: ReportReason;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ReportStatus;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority!: ReportPriority;

  /** Assessed by a moderator during triage; null until assessed. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  severity!: ReportSeverity | null;

  @Column({ type: 'uuid', nullable: true })
  assignedModeratorId!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  resolution!: ReportResolution | null;

  @Column({ type: 'text', nullable: true })
  resolutionReason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
