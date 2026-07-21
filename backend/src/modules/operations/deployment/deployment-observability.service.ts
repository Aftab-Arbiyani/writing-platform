import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { RedisService } from '../../../redis/redis.service';
import { deploymentConfig } from '../../../config/deployment.config';
import { operationsConfig } from '../../../config/operations.config';
import { AuditService } from '../../audit/audit.service';
import { getOperationsObserver } from '../../../common/operations/operations-observer.port';
import { OPS_REDIS } from '../operations.constants';
import type { ChangeType, DeploymentRecord, DeploymentReport } from '../operations.types';
import { nowIso, opsId, round2 } from '../operations.util';

/**
 * Deployment Observability Service (P7.4) — tracks deployments, releases,
 * rollbacks, migrations, and configuration/infrastructure changes. Records live
 * in a durable Redis list (AOF, capped, no migration) and every change is ALSO
 * written to the immutable `audit_logs` trail. The CURRENT build metadata comes
 * from the P7.1 `deploymentConfig` (the SSOT for "what is running where") — this
 * service reuses it, it does not re-derive version/sha/instance.
 *
 * The CD pipeline (or an admin) posts a record at deploy/rollback/migration time;
 * this surface then computes success rate, rollback count, and average duration.
 */
@Injectable()
export class DeploymentObservabilityService {
  private readonly logger = new Logger(DeploymentObservabilityService.name);
  private readonly redis: Redis;

  constructor(
    redisService: RedisService,
    private readonly audit: AuditService,
    @Inject(deploymentConfig.KEY)
    private readonly deployment: ConfigType<typeof deploymentConfig>,
    @Inject(operationsConfig.KEY)
    private readonly config: ConfigType<typeof operationsConfig>,
  ) {
    this.redis = redisService.getClient('auth');
  }

  /** Record a deployment/change event (capped durable list + audit trail). */
  async record(
    input: {
      type: ChangeType;
      version?: string;
      status?: DeploymentRecord['status'];
      durationSeconds?: number | null;
      note?: string | null;
    },
    actorId: string | null,
  ): Promise<DeploymentRecord> {
    const record: DeploymentRecord = {
      id: opsId(),
      type: input.type,
      version: input.version ?? this.deployment.version,
      gitSha: this.deployment.gitShaShort,
      environment: this.deployment.environment,
      status: input.status ?? 'succeeded',
      durationSeconds: input.durationSeconds ?? null,
      at: nowIso(),
      actorId,
      note: input.note ?? null,
    };
    try {
      await this.redis.lpush(OPS_REDIS.deploymentList, JSON.stringify(record));
      await this.redis.ltrim(OPS_REDIS.deploymentList, 0, this.config.deployment.historySize - 1);
    } catch (error) {
      this.logger.warn(`deployment record persist failed: ${(error as Error).message}`);
    }
    try {
      await this.audit.record({
        actorId,
        actorRole: actorId === null ? 'system' : 'admin',
        action: `operations.deployment.${input.type}`,
        targetType: 'operations_deployment',
        targetId: record.id,
        metadata: {
          version: record.version,
          status: record.status,
          environment: record.environment,
        },
      });
    } catch (error) {
      this.logger.warn(`deployment audit failed: ${(error as Error).message}`);
    }
    getOperationsObserver()?.record({
      kind: 'deployment',
      name: 'deploy.recorded',
      ok: record.status !== 'failed',
      attributes: { type: record.type, status: record.status },
    });
    return record;
  }

  /** The deployment-observability report (current build + history + stats). */
  async report(): Promise<DeploymentReport> {
    const recent = await this.history();
    const deployments = recent.filter((r) => r.type === 'deployment');
    const succeeded = deployments.filter((r) => r.status === 'succeeded').length;
    const rollbacks = recent.filter((r) => r.type === 'rollback').length;
    const durations = deployments
      .map((r) => r.durationSeconds)
      .filter((d): d is number => d !== null);

    return {
      generatedAt: nowIso(),
      current: {
        version: this.deployment.version,
        gitSha: this.deployment.gitShaShort,
        environment: this.deployment.environment,
        releaseChannel: this.deployment.releaseChannel,
        instanceId: this.deployment.instanceId,
        startedAt: this.deployment.startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      },
      totalDeployments: deployments.length,
      successRate: deployments.length === 0 ? 1 : round2(succeeded / deployments.length),
      rollbacks,
      averageDurationSeconds:
        durations.length === 0
          ? null
          : round2(durations.reduce((s, d) => s + d, 0) / durations.length),
      recent,
    };
  }

  /** The raw change history (newest first). */
  async history(): Promise<DeploymentRecord[]> {
    try {
      const raw = await this.redis.lrange(OPS_REDIS.deploymentList, 0, -1);
      return raw
        .map((json) => {
          try {
            return JSON.parse(json) as DeploymentRecord;
          } catch {
            return null;
          }
        })
        .filter((r): r is DeploymentRecord => r !== null);
    } catch (error) {
      this.logger.warn(`deployment history unavailable: ${(error as Error).message}`);
      return [];
    }
  }
}
