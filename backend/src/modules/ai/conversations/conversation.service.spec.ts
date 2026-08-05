import { AiConversationStatus } from '@qalam/shared';

import type { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';

describe('ConversationService.list status filter', () => {
  function build() {
    const repo = { list: jest.fn().mockResolvedValue([]) };
    const service = new ConversationService(repo as unknown as ConversationRepository);
    return { repo, service };
  }

  it('defaults to active-only when no status is supplied', async () => {
    const { repo, service } = build();

    await service.list('user-1', undefined, undefined);

    expect(repo.list).toHaveBeenCalledTimes(1);
    const [userId, , , status] = repo.list.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(status).toBe(AiConversationStatus.Active);
  });

  it('passes an explicit archived status straight through', async () => {
    const { repo, service } = build();

    await service.list('user-1', undefined, undefined, AiConversationStatus.Archived);

    expect(repo.list).toHaveBeenCalledTimes(1);
    const [, , , status] = repo.list.mock.calls[0];
    expect(status).toBe(AiConversationStatus.Archived);
    expect(status).toBe('archived');
  });
});
