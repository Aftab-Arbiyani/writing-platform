import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';

/**
 * Wraps `dataSource.transaction` (docs 16 §3.5). Services own transactions;
 * they call `run(...)` and thread the provided `EntityManager` into repository
 * methods that accept an optional manager. Repositories never start
 * transactions themselves.
 *
 * Keep transaction bodies short: no HTTP calls, no queue publishes, no `sharp`
 * work inside — enqueue/side-effect after commit (docs 16 §3.5).
 */
@Injectable()
export class TransactionRunner {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }
}
