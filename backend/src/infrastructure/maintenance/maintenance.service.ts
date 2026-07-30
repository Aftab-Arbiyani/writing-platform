import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { infrastructureConfig } from '../../config/infrastructure.config';
import { AuthMaintenanceService } from '../../modules/auth/services/auth-maintenance.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { PiecesService } from '../../modules/pieces/pieces.service';

/** Row counts touched by the daily cleanup (surfaced in the job log + result). */
export interface DailyCleanupResult {
  expiredVerificationTokens: number;
  expiredPasswordResetTokens: number;
  prunedNotifications: number;
  purgedSoftDeletedPieces: number;
}

/** A table flagged as needing a manual VACUUM (recommendation, not executed). */
export interface VacuumRecommendation {
  table: string;
  deadTuples: number;
  liveTuples: number;
}

/**
 * System maintenance (docs 04 / 14 §7). Orchestrates cleanup by calling each
 * owning module's *exported* service — never another module's repository (the
 * boundary rule). Retention windows come from {@link infrastructureConfig}.
 *
 * Explicitly excluded: `audit_logs` (7-year retention, immutable — docs 14 §7)
 * and `analytics_events` partition pruning (owned by the analytics rollup path).
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly auth: AuthMaintenanceService,
    private readonly notifications: NotificationsService,
    private readonly pieces: PiecesService,
    private readonly dataSource: DataSource,
    @Inject(infrastructureConfig.KEY)
    private readonly config: ConfigType<typeof infrastructureConfig>,
  ) {}

  /** Daily cleanup: expired tokens, old notifications, aged soft-deleted rows. */
  async dailyCleanup(): Promise<DailyCleanupResult> {
    const now = Date.now();
    const retention = this.config.retention;

    const tokenCutoff = new Date(now - retention.expiredTokenDays * 86_400_000);
    const notificationCutoff = new Date(now - retention.notificationDays * 86_400_000);
    const softDeleteCutoff = new Date(now - retention.softDeleteDays * 86_400_000);

    const tokens = await this.auth.pruneExpiredTokens(tokenCutoff);
    const prunedNotifications = await this.notifications.pruneOlderThan(notificationCutoff);
    const purgedSoftDeletedPieces = await this.pieces.purgeSoftDeleted(softDeleteCutoff);

    const result: DailyCleanupResult = {
      expiredVerificationTokens: tokens.verification,
      expiredPasswordResetTokens: tokens.passwordReset,
      prunedNotifications,
      purgedSoftDeletedPieces,
    };
    this.logger.log(`daily-cleanup ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Weekly database maintenance: run `ANALYZE` (safe, non-locking — refreshes
   * planner statistics) and surface VACUUM recommendations from
   * `pg_stat_user_tables`. VACUUM itself is intentionally NOT executed
   * automatically (it can be heavy and cannot run inside a transaction) — the
   * recommendation is logged for an operator to act on.
   */
  async weeklyDbMaintenance(): Promise<{
    analyzed: boolean;
    recommendations: VacuumRecommendation[];
  }> {
    await this.dataSource.query('ANALYZE');

    const rows = await this.dataSource.query<
      { relname: string; n_dead_tup: string; n_live_tup: string }[]
    >(
      `SELECT relname, n_dead_tup, n_live_tup
         FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000 AND n_dead_tup > n_live_tup * 0.2
        ORDER BY n_dead_tup DESC
        LIMIT 20`,
    );
    const recommendations: VacuumRecommendation[] = rows.map((r) => ({
      table: r.relname,
      deadTuples: Number(r.n_dead_tup),
      liveTuples: Number(r.n_live_tup),
    }));

    if (recommendations.length > 0) {
      this.logger.warn(
        `weekly-db-maintenance: ${recommendations.length} table(s) recommended for VACUUM: ` +
          recommendations.map((r) => `${r.table}(${r.deadTuples} dead)`).join(', '),
      );
    } else {
      this.logger.log('weekly-db-maintenance: ANALYZE complete, no VACUUM recommendations');
    }
    return { analyzed: true, recommendations };
  }
}
