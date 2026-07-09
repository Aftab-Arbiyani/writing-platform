import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import { MediaOptimizeHandler } from './handlers/media-processing.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Media worker (docs 02 §6.4) — offloads thumbnail + metadata generation
 * ({@link MediaOptimizeHandler}) from the request path. Low concurrency: sharp
 * is CPU-bound and must not starve the event loop.
 */
@Processor(QUEUE.MediaProcessing, { concurrency: workerConcurrency(QUEUE.MediaProcessing) })
export class MediaProcessingProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.MediaProcessing;

  constructor(optimize: MediaOptimizeHandler) {
    super([optimize]);
  }
}
