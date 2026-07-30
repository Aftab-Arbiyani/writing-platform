import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';

import { QUEUE_NAMES, type QueueName } from '../../common/queue/queue.constants';

/** Max time (ms) to wait for queues to close cleanly during shutdown. */
const SHUTDOWN_DRAIN_TIMEOUT_MS = 20_000;

/**
 * Single lookup point for every registered BullMQ `Queue` instance. The queues
 * themselves are registered via `BullModule.registerQueue(...)` in
 * {@link InfrastructureModule}; this registry resolves them once by their DI
 * token and hands them out by name, so producers, the scheduler, the monitoring
 * service, and the dead-letter service never each re-inject nine queues.
 *
 * P7.1: on boot it validates Redis connectivity per queue (worker startup
 * validation — logged, not fatal, since `/health/ready` already gates traffic);
 * on `SIGTERM`/`SIGINT` it closes every queue within a bounded timeout so a
 * rolling deploy drains in-flight producers cleanly (graceful shutdown).
 */
@Injectable()
export class QueueRegistry implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueRegistry.name);
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    for (const name of QUEUE_NAMES) {
      const queue = this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
      this.queues.set(name, queue);
    }
    this.logger.log(`Registered ${this.queues.size} queues: ${QUEUE_NAMES.join(', ')}`);
    await this.validateConnectivity();
  }

  /**
   * Worker/queue startup validation (P7.1): ping each queue's Redis so a
   * misconfigured connection surfaces at boot as a clear log line rather than a
   * silent first-job failure. Non-fatal — readiness probing is the hard gate.
   */
  private async validateConnectivity(): Promise<void> {
    const failures: string[] = [];
    for (const { name, queue } of this.all()) {
      try {
        // A real Redis round-trip (same technique as QueueHealthIndicator):
        // throws if the queue's connection is unreachable.
        await queue.getWaitingCount();
      } catch (error) {
        failures.push(`${name} (${error instanceof Error ? error.message : 'error'})`);
      }
    }
    if (failures.length > 0) {
      this.logger.warn(`queue.startup.degraded — unreachable: ${failures.join(', ')}`);
    } else {
      this.logger.log('queue.startup.ok — all queue connections reachable');
    }
  }

  /** Graceful shutdown: close every queue within a bounded drain timeout. */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`queue.shutdown.started (signal=${signal ?? 'n/a'})`);
    const closeAll = Promise.allSettled([...this.queues.values()].map((q) => q.close()));
    const timeout = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), SHUTDOWN_DRAIN_TIMEOUT_MS).unref(),
    );
    const outcome = await Promise.race([closeAll, timeout]);
    if (outcome === 'timeout') {
      this.logger.warn(`queue.shutdown.timeout after ${SHUTDOWN_DRAIN_TIMEOUT_MS}ms`);
    } else {
      this.logger.log('queue.shutdown.completed');
    }
  }

  /** Resolve a queue by name; throws if the name is not a registered queue. */
  get(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (queue === undefined) {
      throw new Error(`Queue "${name}" is not registered.`);
    }
    return queue;
  }

  /** True when `name` is one of the registered queues (validates admin route params). */
  has(name: string): name is QueueName {
    return this.queues.has(name as QueueName);
  }

  /** Every registered queue, in catalogue order. */
  all(): { name: QueueName; queue: Queue }[] {
    return QUEUE_NAMES.map((name) => ({ name, queue: this.get(name) }));
  }
}
