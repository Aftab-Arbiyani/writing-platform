import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';

import { QUEUE_NAMES, type QueueName } from '../../common/queue/queue.constants';

/**
 * Single lookup point for every registered BullMQ `Queue` instance. The queues
 * themselves are registered via `BullModule.registerQueue(...)` in
 * {@link InfrastructureModule}; this registry resolves them once by their DI
 * token and hands them out by name, so producers, the scheduler, the monitoring
 * service, and the dead-letter service never each re-inject nine queues.
 */
@Injectable()
export class QueueRegistry implements OnModuleInit {
  private readonly logger = new Logger(QueueRegistry.name);
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    for (const name of QUEUE_NAMES) {
      const queue = this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
      this.queues.set(name, queue);
    }
    this.logger.log(`Registered ${this.queues.size} queues: ${QUEUE_NAMES.join(', ')}`);
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
