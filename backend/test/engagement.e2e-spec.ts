import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Social Engagement e2e (docs 18 E7). Requires Postgres + Redis + MinIO,
 * migrations run, and taxonomy seeded (`pnpm seed` — language `ur` + genre
 * `ghazal`). `X-Client: mobile` yields body tokens. Exercises comments, replies,
 * likes, claps (cap), bookmarks, collections, responses, shares, plus the
 * authorization + validation rules from the epic brief.
 */
describe('Engagement (e2e)', () => {
  let app: INestApplication;
  let author: { id: string; token: string };
  let reader: { id: string; token: string };
  let pieceId: string;
  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ek chhoti si nazm.' }] }],
  };
  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const api = () => request(app.getHttpServer());

  async function register(): Promise<{ id: string; token: string }> {
    const username = `e${randomBytes(5).toString('hex')}`;
    const res = await api()
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'correct horse battery staple',
      })
      .expect(201);
    return { id: res.body.data.user.id, token: res.body.data.accessToken };
  }

  async function publishPiece(
    token: string,
    visibility: 'public' | 'private' = 'public',
  ): Promise<string> {
    const draft = await api()
      .post('/api/v1/pieces')
      .set(...bearer(token))
      .send({ title: 'Nazm', content: doc, languageCode: 'ur', genreSlug: 'ghazal', visibility })
      .expect(201);
    const id = draft.body.data.id;
    await api()
      .post(`/api/v1/pieces/${id}/publish`)
      .set(...bearer(token))
      .expect(200);
    return id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    author = await register();
    reader = await register();
    pieceId = await publishPiece(author.token);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── comments ───────────────────────────────────────────────────────────────

  describe('comments', () => {
    let commentId: string;

    it('rejects anonymous comments (401)', async () => {
      await api().post(`/api/v1/pieces/${pieceId}/comments`).send({ body: 'hi' }).expect(401);
    });

    it('rejects an empty comment (400 validation)', async () => {
      await api()
        .post(`/api/v1/pieces/${pieceId}/comments`)
        .set(...bearer(reader.token))
        .send({ body: '' })
        .expect(400);
    });

    it('creates a comment', async () => {
      const res = await api()
        .post(`/api/v1/pieces/${pieceId}/comments`)
        .set(...bearer(reader.token))
        .send({ body: 'A lovely nazm.' })
        .expect(201);
      expect(res.body.data.body).toBe('A lovely nazm.');
      expect(res.body.data.depth).toBe(1);
      expect(res.body.data.isDeleted).toBe(false);
      commentId = res.body.data.id;
    });

    it('enforces max reply depth = 3', async () => {
      const reply = async (parent: string): Promise<string> => {
        const r = await api()
          .post(`/api/v1/comments/${parent}/replies`)
          .set(...bearer(author.token))
          .send({ body: 'reply' })
          .expect(201);
        return r.body.data.id;
      };
      const d2 = await reply(commentId); // depth 2
      const d3 = await reply(d2); // depth 3
      await api()
        .post(`/api/v1/comments/${d3}/replies`)
        .set(...bearer(author.token))
        .send({ body: 'too deep' })
        .expect(422)
        .expect((r) => expect(r.body.error.code).toBe('COMMENT_DEPTH_EXCEEDED'));
    });

    it('forbids a non-owner from editing (403)', async () => {
      await api()
        .patch(`/api/v1/comments/${commentId}`)
        .set(...bearer(author.token))
        .send({ body: 'hijack' })
        .expect(403)
        .expect((r) => expect(r.body.error.code).toBe('COMMENT_FORBIDDEN'));
    });

    it('lets the owner edit (records edited_at)', async () => {
      const res = await api()
        .patch(`/api/v1/comments/${commentId}`)
        .set(...bearer(reader.token))
        .send({ body: 'Edited nazm comment.' })
        .expect(200);
      expect(res.body.data.body).toBe('Edited nazm comment.');
      expect(res.body.data.editedAt).not.toBeNull();
    });

    it('lists top-level comments with reply counts (cursor-paginated)', async () => {
      const res = await api().get(`/api/v1/pieces/${pieceId}/comments`).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const top = res.body.data.find((c: { id: string }) => c.id === commentId);
      expect(top.replyCount).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.pagination).toHaveProperty('hasMore');
    });

    it('soft-deletes (owner): tombstone shown, replies remain visible', async () => {
      await api()
        .delete(`/api/v1/comments/${commentId}`)
        .set(...bearer(reader.token))
        .expect(204);
      const res = await api().get(`/api/v1/pieces/${pieceId}/comments`).expect(200);
      const top = res.body.data.find((c: { id: string }) => c.id === commentId);
      expect(top.isDeleted).toBe(true);
      expect(top.body).toBe('This comment has been deleted.');
      expect(top.author).toBeNull();
      // Replies to the deleted comment are still visible.
      const replies = await api().get(`/api/v1/comments/${commentId}/replies`).expect(200);
      expect(replies.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── likes ────────────────────────────────────────────────────────────────

  describe('likes', () => {
    it('likes, is idempotent, and unlikes', async () => {
      const first = await api()
        .post(`/api/v1/pieces/${pieceId}/likes`)
        .set(...bearer(reader.token))
        .expect(200);
      expect(first.body.data).toEqual({ liked: true, totalLikes: 1 });
      // Idempotent — a second like does not double-count.
      const again = await api()
        .post(`/api/v1/pieces/${pieceId}/likes`)
        .set(...bearer(reader.token))
        .expect(200);
      expect(again.body.data.totalLikes).toBe(1);

      const engaged = await api()
        .get(`/api/v1/pieces/${pieceId}/engagement`)
        .set(...bearer(reader.token))
        .expect(200);
      expect(engaged.body.data.viewer.hasLiked).toBe(true);
      expect(engaged.body.data.stats.likes).toBe(1);

      await api()
        .delete(`/api/v1/pieces/${pieceId}/likes`)
        .set(...bearer(reader.token))
        .expect(204);
    });
  });

  // ── claps ────────────────────────────────────────────────────────────────

  describe('claps', () => {
    it('accumulates and caps at 50, then rejects the 51st', async () => {
      const first = await api()
        .post(`/api/v1/pieces/${pieceId}/claps`)
        .set(...bearer(reader.token))
        .send({ count: 5 })
        .expect(200);
      expect(first.body.data.viewerClaps).toBe(5);

      const capped = await api()
        .post(`/api/v1/pieces/${pieceId}/claps`)
        .set(...bearer(reader.token))
        .send({ count: 50 })
        .expect(200);
      expect(capped.body.data.viewerClaps).toBe(50); // 5 + 45 (capped)

      await api()
        .post(`/api/v1/pieces/${pieceId}/claps`)
        .set(...bearer(reader.token))
        .send({ count: 1 })
        .expect(422)
        .expect((r) => expect(r.body.error.code).toBe('CLAP_LIMIT_REACHED'));
    });
  });

  // ── bookmarks ──────────────────────────────────────────────────────────────

  describe('bookmarks', () => {
    it('bookmarks (private), lists in /me/bookmarks, then removes', async () => {
      await api()
        .post(`/api/v1/pieces/${pieceId}/bookmarks`)
        .set(...bearer(reader.token))
        .expect(200)
        .expect((r) => expect(r.body.data.bookmarked).toBe(true));

      const list = await api()
        .get('/api/v1/me/bookmarks')
        .set(...bearer(reader.token))
        .expect(200);
      expect(list.body.data.some((b: { pieceId: string }) => b.pieceId === pieceId)).toBe(true);

      await api()
        .delete(`/api/v1/pieces/${pieceId}/bookmarks`)
        .set(...bearer(reader.token))
        .expect(204);
    });
  });

  // ── collections ────────────────────────────────────────────────────────────

  describe('collections', () => {
    let collectionId: string;

    it('auto-creates the default "Favorites" and lists collections', async () => {
      const created = await api()
        .post('/api/v1/collections')
        .set(...bearer(reader.token))
        .send({ title: 'Monsoon poems' })
        .expect(201);
      collectionId = created.body.data.id;

      const list = await api()
        .get('/api/v1/collections')
        .set(...bearer(reader.token))
        .expect(200);
      const titles = list.body.data.map((c: { title: string }) => c.title);
      expect(titles).toContain('Favorites');
      expect(titles).toContain('Monsoon poems');
    });

    it('rejects a duplicate collection (409)', async () => {
      await api()
        .post('/api/v1/collections')
        .set(...bearer(reader.token))
        .send({ title: 'Monsoon poems' })
        .expect(409)
        .expect((r) => expect(r.body.error.code).toBe('COLLECTION_NAME_TAKEN'));
    });

    it('adds a piece (no duplicates) and removes it', async () => {
      const added = await api()
        .post(`/api/v1/collections/${collectionId}/pieces`)
        .set(...bearer(reader.token))
        .send({ pieceId })
        .expect(200);
      expect(added.body.data.piecesCount).toBe(1);

      await api()
        .post(`/api/v1/collections/${collectionId}/pieces`)
        .set(...bearer(reader.token))
        .send({ pieceId })
        .expect(409)
        .expect((r) => expect(r.body.error.code).toBe('COLLECTION_PIECE_EXISTS'));

      const contents = await api()
        .get(`/api/v1/collections/${collectionId}/pieces`)
        .set(...bearer(reader.token))
        .expect(200);
      expect(contents.body.data.some((p: { pieceId: string }) => p.pieceId === pieceId)).toBe(true);

      await api()
        .delete(`/api/v1/collections/${collectionId}/pieces/${pieceId}`)
        .set(...bearer(reader.token))
        .expect(204);
    });

    it('is private — a non-owner cannot read it (404)', async () => {
      await api()
        .get(`/api/v1/collections/${collectionId}`)
        .set(...bearer(author.token))
        .expect(404);
    });

    it('protects the default "Favorites" from rename and delete', async () => {
      const list = await api()
        .get('/api/v1/collections')
        .set(...bearer(reader.token))
        .expect(200);
      const fav = list.body.data.find((c: { isDefault: boolean }) => c.isDefault);
      await api()
        .patch(`/api/v1/collections/${fav.id}`)
        .set(...bearer(reader.token))
        .send({ title: 'Renamed' })
        .expect(422)
        .expect((r) => expect(r.body.error.code).toBe('COLLECTION_DEFAULT_IMMUTABLE'));
      await api()
        .delete(`/api/v1/collections/${fav.id}`)
        .set(...bearer(reader.token))
        .expect(422);
    });

    it('deletes a custom collection', async () => {
      await api()
        .delete(`/api/v1/collections/${collectionId}`)
        .set(...bearer(reader.token))
        .expect(204);
    });
  });

  // ── responses ──────────────────────────────────────────────────────────────

  describe('responses', () => {
    it('creates a response piece, links it, and lists it once published', async () => {
      const created = await api()
        .post(`/api/v1/pieces/${pieceId}/responses`)
        .set(...bearer(reader.token))
        .send({ title: 'My response', content: doc, languageCode: 'ur', genreSlug: 'ghazal' })
        .expect(201);
      const responseId = created.body.data.id;
      expect(created.body.data.status).toBe('draft');

      // A response IS a piece — publish it so it appears in the visible list.
      await api()
        .post(`/api/v1/pieces/${responseId}/publish`)
        .set(...bearer(reader.token))
        .expect(200);

      const list = await api().get(`/api/v1/pieces/${pieceId}/responses`).expect(200);
      expect(list.body.data.some((r: { pieceId: string }) => r.pieceId === responseId)).toBe(true);

      const engaged = await api().get(`/api/v1/pieces/${pieceId}/engagement`).expect(200);
      expect(engaged.body.data.stats.responses).toBeGreaterThanOrEqual(1);
    });
  });

  // ── shares ───────────────────────────────────────────────────────────────

  describe('shares', () => {
    it('tracks a share count (works for anonymous readers)', async () => {
      const authed = await api()
        .post(`/api/v1/pieces/${pieceId}/shares`)
        .set(...bearer(reader.token))
        .send({ channel: 'external' })
        .expect(200);
      expect(authed.body.data.totalShares).toBeGreaterThanOrEqual(1);

      // Public route — anonymous share of a public piece is allowed.
      const anon = await api()
        .post(`/api/v1/pieces/${pieceId}/shares`)
        .send({ channel: 'copy_link' })
        .expect(200);
      expect(anon.body.data.totalShares).toBeGreaterThanOrEqual(2);
    });
  });

  // ── authorization / visibility ─────────────────────────────────────────────

  describe('authorization & visibility', () => {
    it('the owner cannot engage with their own unpublished piece (409)', async () => {
      const draft = await api()
        .post('/api/v1/pieces')
        .set(...bearer(author.token))
        .send({ title: 'Draft', content: doc, languageCode: 'ur', genreSlug: 'ghazal' })
        .expect(201);
      // The owner can see the draft, but engagement requires it to be published.
      await api()
        .post(`/api/v1/pieces/${draft.body.data.id}/likes`)
        .set(...bearer(author.token))
        .expect(409)
        .expect((r) => expect(r.body.error.code).toBe('PIECE_NOT_PUBLISHED'));
      // A non-owner cannot even see the draft — 404, privacy-preserving.
      await api()
        .post(`/api/v1/pieces/${draft.body.data.id}/likes`)
        .set(...bearer(reader.token))
        .expect(404)
        .expect((r) => expect(r.body.error.code).toBe('PIECE_NOT_FOUND'));
    });

    it('cannot engage with a private piece (404, privacy-preserving)', async () => {
      const privateId = await publishPiece(author.token, 'private');
      await api()
        .post(`/api/v1/pieces/${privateId}/likes`)
        .set(...bearer(reader.token))
        .expect(404)
        .expect((r) => expect(r.body.error.code).toBe('PIECE_NOT_FOUND'));
    });
  });
});
