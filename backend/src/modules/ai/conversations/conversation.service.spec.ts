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

/**
 * **W8-3** (docs/48 §3.12) — the export publishes its messages in a different shape from
 * `GET /ai/conversations/:id`: no `id`, and token usage flattened to one nullable number. That is
 * deliberate (see `AiConversationExportMessageDto`), and what was missing was any assertion that it
 * is deliberate. The contract guard now pins the DTO against `@qalam/api-types`; this pins the DTO
 * against what the service actually builds, which is the half a type cannot check.
 */
describe('ConversationService.export — the second message shape, asserted as intended', () => {
  const CREATED = new Date('2026-08-19T10:00:00.000Z');
  const UPDATED = new Date('2026-08-19T11:00:00.000Z');

  function build(messages: unknown[]) {
    const repo = {
      findOwned: jest.fn().mockResolvedValue({
        id: 'conv-1',
        feature: 'writing_assistant',
        title: 'A draft',
        status: AiConversationStatus.Active,
        createdAt: CREATED,
        updatedAt: UPDATED,
      }),
      listMessages: jest.fn().mockResolvedValue(messages),
    };
    return new ConversationService(repo as unknown as ConversationRepository);
  }

  it('flattens token usage and omits the message id', async () => {
    const service = build([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Some prose.',
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        createdAt: CREATED,
      },
    ]);

    const document = await service.export('user-1', 'conv-1');

    expect(document.messages).toEqual([
      {
        role: 'assistant',
        content: 'Some prose.',
        totalTokens: 30,
        createdAt: CREATED.toISOString(),
      },
    ]);
    // Stated as its own expectation: a client reusing `AiMessageDto` here would read `undefined`,
    // which is the mistake this row exists to make impossible to reintroduce silently.
    expect(document.messages[0]).not.toHaveProperty('id');
    expect(document.messages[0]).not.toHaveProperty('usage');
  });

  it('carries a null totalTokens through rather than coercing it to 0', async () => {
    // The field is nullable because a user turn has no usage. A 0 would read as "measured, and free".
    const service = build([
      { id: 'msg-2', role: 'user', content: 'Ask.', totalTokens: null, createdAt: CREATED },
    ]);

    const document = await service.export('user-1', 'conv-1');

    expect(document.messages[0]?.totalTokens).toBeNull();
  });

  it('serialises every date as an ISO string, envelope included', async () => {
    const service = build([]);

    const document = await service.export('user-1', 'conv-1');

    expect(document).toMatchObject({
      id: 'conv-1',
      feature: 'writing_assistant',
      title: 'A draft',
      status: AiConversationStatus.Active,
      createdAt: CREATED.toISOString(),
      updatedAt: UPDATED.toISOString(),
      messages: [],
    });
  });
});
