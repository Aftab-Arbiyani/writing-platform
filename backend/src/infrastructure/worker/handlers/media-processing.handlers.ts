import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { MediaService } from '../../../media/media.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const mediaOptimizePayload = z.object({
  key: z.string().min(1),
  kind: z.enum(['avatar', 'cover']),
});

/**
 * Background media pass: thumbnail + metadata for an already-uploaded original
 * (docs 13 §7). Reuses `MediaService.processInBackground` (sharp), off the
 * request path. Low concurrency — CPU-bound.
 */
@Injectable()
export class MediaOptimizeHandler extends AbstractJobHandler<typeof JOB.MediaOptimize> {
  readonly job = JOB.MediaOptimize;

  constructor(private readonly media: MediaService) {
    super();
  }

  validate(raw: unknown): { key: string; kind: 'avatar' | 'cover' } {
    return mediaOptimizePayload.parse(raw);
  }

  handle(data: { key: string; kind: 'avatar' | 'cover' }): Promise<unknown> {
    return this.media.processInBackground(data.key, data.kind);
  }
}
