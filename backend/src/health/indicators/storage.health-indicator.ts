import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { MediaStorageService } from '../../media/media-storage.service';

/**
 * Readiness probe for object storage (S3/MinIO): `HEAD` the media bucket
 * (docs 14 §3). Storage is "degraded-not-dead" — the readiness aggregation may
 * choose to stay ready if only storage is down (reads still work) — so this
 * indicator only reports up/down; the policy lives in the controller.
 */
@Injectable()
export class StorageHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly storage: MediaStorageService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.storage.checkHealth();
      return indicator.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'storage HEAD failed';
      return indicator.down({ message });
    }
  }
}
