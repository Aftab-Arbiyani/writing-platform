import { ApiProperty } from '@nestjs/swagger';

import { AuditLogDto, AuditSummaryDto } from '../../audit/dto/audit-log.dto';

/**
 * One row of the admin user grid (`GET /admin/users`). `avatarKey` is the raw
 * S3 key (clients resolve it via `mediaUrl()`, matching the profile contract).
 * `lastActiveAt` is approximated by the last login — Qalam stores no separate
 * activity signal (documented honestly rather than faked).
 */
export class AdminUserListItemDto {
  @ApiProperty({ example: '0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11' }) id!: string;
  @ApiProperty({ nullable: true, description: 'Avatar S3 key (resolve with mediaUrl()).' })
  avatarKey!: string | null;
  @ApiProperty({ example: 'meera_k' }) username!: string;
  @ApiProperty({ nullable: true, description: 'Display / pen name.' }) displayName!: string | null;
  @ApiProperty({ example: 'meera@example.com' }) email!: string;
  @ApiProperty({ example: 'user', description: 'Effective role.' }) role!: string;
  @ApiProperty({ example: 'active', description: 'active | suspended | deactivated.' })
  status!: string;
  @ApiProperty({ description: 'Email verified (has a verification timestamp).' })
  verified!: boolean;
  @ApiProperty() isPrivate!: boolean;
  @ApiProperty() followers!: number;
  @ApiProperty() following!: number;
  @ApiProperty({ description: 'Published-pieces count (denormalized).' }) publishedPieces!: number;
  @ApiProperty({ description: 'Draft-pieces count.' }) draftCount!: number;
  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ nullable: true, description: 'Approximated by last login (no activity table).' })
  lastActiveAt!: string | null;
  @ApiProperty({ nullable: true, description: 'Soft-delete timestamp, null if active.' })
  deletedAt!: string | null;
}

/** Full profile block inside the detail view. */
export class AdminUserProfileDto {
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty({ nullable: true }) avatarKey!: string | null;
  @ApiProperty({ nullable: true }) coverKey!: string | null;
  @ApiProperty({ nullable: true }) websiteUrl!: string | null;
  @ApiProperty({ nullable: true }) location!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  socialLinks!: Record<string, string>;
}

/** Aggregated user statistics (`GET /admin/users/:id/statistics`). */
export class AdminUserStatisticsDto {
  @ApiProperty() views!: number;
  @ApiProperty() reads!: number;
  @ApiProperty() followers!: number;
  @ApiProperty() following!: number;
  @ApiProperty() publishedPieces!: number;
  @ApiProperty() drafts!: number;
  @ApiProperty() comments!: number;
  @ApiProperty() bookmarks!: number;
  @ApiProperty() claps!: number;
  @ApiProperty() responses!: number;
}

/**
 * Moderation snapshot. Qalam has no report/warning store yet, so `reports` and
 * `warnings` are structurally present but zero; `statusChanges` is derived from
 * the real audit trail (honest, not faked — see module README).
 */
export class AdminUserModerationSummaryDto {
  @ApiProperty({ example: 'active' }) currentStatus!: string;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ description: 'Open reports against the user (report store not built → 0).' })
  reports!: number;
  @ApiProperty({ description: 'Warnings issued (warning store not built → 0).' })
  warnings!: number;
  @ApiProperty({ description: 'Recorded status changes (from the audit trail).' })
  statusChanges!: number;
  @ApiProperty({ nullable: true, description: 'Timestamp of the last admin action.' })
  lastActionAt!: string | null;
}

/** Complete admin detail view (`GET /admin/users/:id`). */
export class AdminUserDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() status!: string;
  @ApiProperty() verified!: boolean;
  @ApiProperty() isPrivate!: boolean;
  @ApiProperty({ type: AdminUserProfileDto }) profile!: AdminUserProfileDto;
  @ApiProperty({ type: AdminUserStatisticsDto }) statistics!: AdminUserStatisticsDto;
  @ApiProperty({ type: AdminUserModerationSummaryDto })
  moderation!: AdminUserModerationSummaryDto;
  @ApiProperty({ type: AuditSummaryDto }) auditSummary!: AuditSummaryDto;
  @ApiProperty({ type: [AuditLogDto], description: 'Most recent admin actions on the user.' })
  recentActivity!: AuditLogDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ nullable: true }) deletedAt!: string | null;
}

/** A single login timestamp (the only login datum Qalam persists). */
export class LoginEventDto {
  @ApiProperty({ example: '2026-07-09T18:30:00.000Z' }) at!: string;
}

/**
 * Login history (`GET /admin/users/:id/login-history`). Qalam persists only the
 * last successful login (`users.last_login_at`); failed attempts, devices, and
 * IPs are NOT stored (they exist only as ephemeral logs / expiring Redis
 * sessions), so those arrays are empty by design — surfaced honestly.
 */
export class AdminLoginHistoryDto {
  @ApiProperty({ nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ type: [LoginEventDto], description: 'Persisted successful logins (last only).' })
  successfulLogins!: LoginEventDto[];
  @ApiProperty({ type: [LoginEventDto], description: 'Not persisted — always empty.' })
  failedLogins!: LoginEventDto[];
  @ApiProperty({ type: [String], description: 'Not persisted — always empty.' })
  devices!: string[];
  @ApiProperty({ type: [String], description: 'Not persisted — always empty.' })
  ipAddresses!: string[];
  @ApiProperty({ description: 'Explains what login data is and is not available.' })
  note!: string;
}

/** User activity view (`GET /admin/users/:id/activity`). */
export class AdminUserActivityDto {
  @ApiProperty({ type: [LoginEventDto], description: 'Recent logins (last login only).' })
  recentLogins!: LoginEventDto[];
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Publishing activity: { publishedPieces, drafts }.',
  })
  publishing!: Record<string, number>;
  @ApiProperty({ type: [AuditLogDto], description: 'Status/role moderation events.' })
  moderationActivity!: AuditLogDto[];
  @ApiProperty({ type: [AuditLogDto], description: 'Security/administrative account events.' })
  accountEvents!: AuditLogDto[];
  @ApiProperty({ description: 'Explains which activity signals are and are not tracked.' })
  note!: string;
}

/** Result of a single admin mutation (verify/suspend/…, PATCH). */
export class AdminActionResultDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'user.suspend', description: 'Action performed.' }) action!: string;
  @ApiProperty({ example: 'active', nullable: true, description: 'State before the change.' })
  before!: string | null;
  @ApiProperty({ example: 'suspended', nullable: true, description: 'State after the change.' })
  after!: string | null;
  @ApiProperty({ description: 'Human-readable outcome.' }) message!: string;
}
