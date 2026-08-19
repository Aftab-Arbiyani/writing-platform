import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { RetrievalQueryLog } from '../entities/retrieval-query-log.entity';

/**
 * Aggregation is bounded, so a busy install cannot pull an unbounded window into memory.
 * Exported because a capped read is a truncated SAMPLE, and the surface reporting those
 * figures has to be able to say so (`SearchAnalyticsData.truncated`).
 */
export const ANALYTICS_ROW_CAP = 5_000;

/** Persistence for retrieval telemetry (AF4). Append-only; the service records best-effort. */
@Injectable()
export class RetrievalLogRepository {
  constructor(
    @InjectRepository(RetrievalQueryLog) private readonly logs: Repository<RetrievalQueryLog>,
  ) {}

  async record(entry: Partial<RetrievalQueryLog>): Promise<void> {
    await this.logs.save(this.logs.create(entry));
  }

  /** Rows since `from`, newest first, capped (analytics is a bounded aggregation). */
  since(from: Date): Promise<RetrievalQueryLog[]> {
    return this.logs.find({
      where: { createdAt: MoreThanOrEqual(from) },
      order: { createdAt: 'DESC' },
      take: ANALYTICS_ROW_CAP,
    });
  }
}
