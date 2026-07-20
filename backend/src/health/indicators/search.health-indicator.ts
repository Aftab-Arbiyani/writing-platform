import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { DataSource } from 'typeorm';

/**
 * Search health (P7.1). Qalam search is Postgres full-text — there is no
 * separate search engine — so this probe verifies the FTS path is functional
 * (`to_tsvector`/`tsquery`), which is a tighter signal than a bare `SELECT 1`
 * because it exercises the text-search operators the search module depends on.
 */
@Injectable()
export class SearchHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.dataSource.query(
        `SELECT to_tsvector('simple', $1) @@ plainto_tsquery('simple', $1) AS ok`,
        ['qalam-health-probe'],
      );
      return indicator.up({ engine: 'postgres-fts' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'search FTS check failed';
      return indicator.down({ message });
    }
  }
}
