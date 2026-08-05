import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '@/lib/api-client';

import { aiApi } from './ai.api';

vi.mock('@/lib/api-client');

const get = vi.mocked(apiClient.get);
const getPage = vi.mocked(apiClient.getPage);
const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const del = vi.mocked(apiClient.del);

/**
 * Wire pins for the six conversation routes + `GET /ai/usage/me` (W8 Phase 1).
 *
 * These assert the **wire** — exact path, exact method, exact body keys — not that the client
 * abstraction resolves. That distinction is the whole reason this file exists: the global pipe runs
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` (`backend/src/main.ts:170`), so an
 * undeclared key is not dropped, it **400s the request**. Three shipped drifts (W4-2, W4-5, W5-1)
 * were all of exactly that shape, and a test asserting "rename resolves" would have shipped each.
 *
 * Every field below is traceable to a DTO cited in docs/48 §3.12.
 */
describe('aiApi conversation + usage wire shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({} as never);
    getPage.mockResolvedValue({ items: [], meta: { nextCursor: null, hasMore: false } } as never);
    post.mockResolvedValue({} as never);
    patch.mockResolvedValue({} as never);
    del.mockResolvedValue(undefined as never);
  });

  describe('POST /ai/conversations', () => {
    // CreateAiConversationDto (ai-request.dto.ts:158-168): feature required, title optional.
    it('sends feature alone when no title is given', async () => {
      await aiApi.createConversation({ feature: 'writing_assistant' });
      expect(post).toHaveBeenCalledWith('/ai/conversations', { feature: 'writing_assistant' });
    });

    it('sends title alongside feature and nothing else', async () => {
      await aiApi.createConversation({ feature: 'craft_coach', title: 'Chapter three' });
      const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body).toEqual({ feature: 'craft_coach', title: 'Chapter three' });
    });
  });

  describe('GET /ai/conversations', () => {
    // ConversationListQueryDto (ai-request.dto.ts:236-249) declares ONLY cursor + limit. Any other
    // query key would 400, so the query string is part of the contract.
    it('requests the bare path when given no cursor or limit', async () => {
      await aiApi.listConversations({});
      expect(getPage).toHaveBeenCalledWith('/ai/conversations', { signal: undefined });
    });

    it('puts cursor and limit in the query string', async () => {
      await aiApi.listConversations({ cursor: 'abc123', limit: 20 });
      const path = getPage.mock.calls[0]?.[0] as string;
      expect(path).toContain('cursor=abc123');
      expect(path).toContain('limit=20');
    });

    it('reads the page through getPage, which is what unwraps meta.pagination', async () => {
      // The list handler hand-builds `{success, data, meta:{pagination}}`
      // (ai-conversations.controller.ts:70-74) so it passes TransformInterceptor untouched. `getPage`
      // is the only client helper that reads `meta.pagination`; `get` would drop the cursor.
      await aiApi.listConversations({});
      expect(getPage).toHaveBeenCalledTimes(1);
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('GET /ai/conversations/:id', () => {
    it('encodes the id into the path', async () => {
      await aiApi.getConversation('a/b c');
      expect(get).toHaveBeenCalledWith('/ai/conversations/a%2Fb%20c', { signal: undefined });
    });
  });

  describe('PATCH /ai/conversations/:id', () => {
    // UpdateAiConversationDto (ai-request.dto.ts:171-182): title? + status?, both optional.
    it('sends title alone for a rename', async () => {
      await aiApi.updateConversation('id-1', { title: 'Renamed' });
      expect(patch).toHaveBeenCalledWith('/ai/conversations/id-1', { title: 'Renamed' });
    });

    it('does not smuggle a status key into a rename', async () => {
      // The handler applies title and status independently (controller :100-107). Sending
      // `status: undefined` would serialize away, but sending it explicitly on every rename would
      // make an accidental restatus one typo away.
      await aiApi.updateConversation('id-1', { title: 'Renamed' });
      const body = patch.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(['title']);
    });
  });

  describe('DELETE /ai/conversations/:id', () => {
    it('deletes by id and expects no body back', async () => {
      // The route is @HttpCode(204) with @ApiNoContentResponse (controller :113-115).
      await expect(aiApi.deleteConversation('id-1')).resolves.toBeUndefined();
      expect(del).toHaveBeenCalledWith('/ai/conversations/id-1');
    });
  });

  describe('GET /ai/conversations/:id/export', () => {
    it('requests the export sub-path', async () => {
      await aiApi.exportConversation('id-1');
      expect(get).toHaveBeenCalledWith('/ai/conversations/id-1/export', { signal: undefined });
    });

    it('goes through the enveloped GET, because the route is JSON and not a file', async () => {
      // No Content-Disposition and no stream: the handler returns a plain object
      // (controller :128-133), so this is an ordinary `{success, data}` read. If it ever becomes a
      // real file response, this assertion is what fails.
      await aiApi.exportConversation('id-1');
      expect(get).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /ai/usage/me', () => {
    it('reads the caller-scoped usage path', async () => {
      await aiApi.usage();
      expect(get).toHaveBeenCalledWith('/ai/usage/me', { signal: undefined });
    });

    it('is NOT the monetization usage route', async () => {
      // AF1 token telemetry vs the AF5 billing rollup — two routes, two lenses, W4 shipped the other
      // one. Pinned so a later refactor cannot quietly point this surface at /monetization/usage
      // (docs/48 §3.12 verdicts; C3 of the W8 row).
      await aiApi.usage();
      expect(get.mock.calls[0]?.[0]).not.toContain('monetization');
    });
  });
});
