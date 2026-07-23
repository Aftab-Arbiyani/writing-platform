import type { TestInfo } from '@playwright/test';

/**
 * A per-process run seed (base36 timestamp), fixed once at module load. Combined
 * with the worker/parallel index + a per-test counter this gives BOTH intra-run
 * uniqueness (under parallelism) AND run-to-run uniqueness — so re-running the
 * suite against a persistent DB never collides with a prior run's records
 * (docs/e2e/04 §4). `Date.now()` is allowed in test code (only workflow scripts forbid it).
 */
const RUN_SEED = Date.now().toString(36);

/**
 * Unique-data factory (docs/e2e/04 §4). Every created record carries an `e2e`
 * marker so leftover rows are recognizable.
 */
export class DataFactory {
  private counter = 0;

  constructor(private readonly info: TestInfo) {}

  private uniq(): string {
    const seq = this.counter++;
    return `${RUN_SEED}-${this.info.workerIndex}-${this.info.parallelIndex}-${seq}`;
  }

  /** A unique piece title, e.g. "E2E Piece 0-0-1-a1b2c3". */
  pieceTitle(): string {
    return `E2E Piece ${this.uniq()}`;
  }

  /** A unique, regex-valid username (^[a-z0-9_]{3,30}$). */
  username(): string {
    return `e2e_${this.uniq()}`
      .replace(/[^a-z0-9_]/gi, '_')
      .toLowerCase()
      .slice(0, 30);
  }

  /** A unique email. Uses a subaddress so all E2E mail is filterable. */
  email(): string {
    return `e2e_${this.uniq()}@qalam.local`.toLowerCase();
  }

  /** A policy-valid password (10–128 chars). */
  password(): string {
    return `E2ePass!${this.uniq()}`;
  }
}
