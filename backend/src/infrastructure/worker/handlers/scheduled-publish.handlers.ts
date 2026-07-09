import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { PiecesService } from '../../../modules/pieces/pieces.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const noPayload = z.object({});
const publishOnePayload = z.object({ pieceId: z.string().min(1) });

/** Reconciliation sweep: publish every scheduled piece now due (docs 02 §6.2). */
@Injectable()
export class PublishDueHandler extends AbstractJobHandler<typeof JOB.PublishDue> {
  readonly job = JOB.PublishDue;

  constructor(private readonly pieces: PiecesService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  handle(): Promise<{ published: string[]; failed: string[] }> {
    return this.pieces.publishDueScheduled();
  }
}

/** Delayed single-piece publish: re-verifies still-scheduled at fire time. */
@Injectable()
export class PublishOneHandler extends AbstractJobHandler<typeof JOB.PublishOne> {
  readonly job = JOB.PublishOne;

  constructor(private readonly pieces: PiecesService) {
    super();
  }

  validate(raw: unknown): { pieceId: string } {
    return publishOnePayload.parse(raw);
  }

  async handle(data: { pieceId: string }): Promise<{ pieceId: string; published: boolean }> {
    return {
      pieceId: data.pieceId,
      published: await this.pieces.publishScheduledById(data.pieceId),
    };
  }
}
