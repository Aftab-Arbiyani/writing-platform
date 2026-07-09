import { UnrecoverableError } from 'bullmq';

import type { JobContext } from '../../../common/queue/job-handler';
import type { PiecesService } from '../../../modules/pieces/pieces.service';
import { PublishDueHandler, PublishOneHandler } from './scheduled-publish.handlers';

const ctx: JobContext = { requestId: 'r', jobId: 'j', attempt: 1 };

function pieces() {
  return {
    publishDueScheduled: jest.fn().mockResolvedValue({ published: ['p1'], failed: [] }),
    publishScheduledById: jest.fn().mockResolvedValue(true),
  };
}

describe('scheduled-publish job handlers', () => {
  it('PublishDueHandler runs the sweep', async () => {
    const svc = pieces();
    const handler = new PublishDueHandler(svc as unknown as PiecesService);
    const result = await handler.run({}, ctx);
    expect(svc.publishDueScheduled).toHaveBeenCalled();
    expect(result).toEqual({ published: ['p1'], failed: [] });
  });

  it('PublishOneHandler validates and publishes one piece', async () => {
    const svc = pieces();
    const handler = new PublishOneHandler(svc as unknown as PiecesService);
    const result = await handler.run({ pieceId: 'abc' }, ctx);
    expect(svc.publishScheduledById).toHaveBeenCalledWith('abc');
    expect(result).toEqual({ pieceId: 'abc', published: true });
  });

  it('PublishOneHandler dead-letters an invalid payload (UnrecoverableError)', async () => {
    const svc = pieces();
    const handler = new PublishOneHandler(svc as unknown as PiecesService);
    // Missing pieceId → zod validation fails → wrapped as UnrecoverableError.
    await expect(handler.run({}, ctx)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(svc.publishScheduledById).not.toHaveBeenCalled();
  });
});
