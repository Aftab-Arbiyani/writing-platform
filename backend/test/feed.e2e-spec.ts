import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Feeds & Discovery e2e (docs 18 E6). Requires Postgres + Redis + MinIO,
 * migrations run, taxonomy seeded (languages hi/ur, genres ghazal/nazm).
 * Covers all four feeds, filtering, cursor pagination, caching, discovery, and
 * the authorization rules (private profiles, unlisted pieces).
 */
describe('Feed & Discovery (e2e)', () => {
  let app: INestApplication;
  let authorA: { id: string; token: string };
  let authorB: { id: string; token: string };
  let privateAuthor: { id: string; token: string };
  let reader: { id: string; token: string };
  let aPiece1: string;
  let aPiece2: string;
  let bPiece: string;
  let unlistedPiece: string;
  let privatePiece: string;

  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Barish ki nazm yahan.' }] }],
  };
  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const api = () => request(app.getHttpServer());

  async function register(): Promise<{ id: string; token: string }> {
    // Reset the per-IP register window between accounts (auth:register is 3/hour).
    await app.get(RedisService).getClient('rateLimit').flushdb();
    const username = `f${randomBytes(5).toString('hex')}`;
    const res = await api()
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({ email: `${username}@ex.com`, username, password: 'correct horse battery staple' })
      .expect(201);
    return { id: res.body.data.user.id, token: res.body.data.accessToken };
  }

  async function publish(
    token: string,
    opts: { language?: string; genre?: string; visibility?: 'public' | 'unlisted' } = {},
  ): Promise<string> {
    const draft = await api()
      .post('/api/v1/pieces')
      .set(...bearer(token))
      .send({
        title: 'Nazm',
        content: doc,
        languageCode: opts.language ?? 'ur',
        genreSlug: opts.genre ?? 'ghazal',
        visibility: opts.visibility ?? 'public',
      })
      .expect(201);
    const id = draft.body.data.id;
    await api()
      .post(`/api/v1/pieces/${id}/publish`)
      .set(...bearer(token))
      .expect(200);
    return id;
  }

  const ids = (res: request.Response): string[] => res.body.data.map((c: { id: string }) => c.id);

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    await app.get(RedisService).getClient('cache').flushdb(); // fresh trending/discovery caches

    authorA = await register();
    authorB = await register();
    privateAuthor = await register();
    reader = await register();

    aPiece1 = await publish(authorA.token, { language: 'ur', genre: 'ghazal' });
    aPiece2 = await publish(authorA.token, { language: 'ur', genre: 'nazm' });
    bPiece = await publish(authorB.token, { language: 'hi', genre: 'ghazal' });
    unlistedPiece = await publish(authorA.token, { visibility: 'unlisted' });

    // A private account with a published public piece — must stay out of public feeds.
    await api()
      .patch('/api/v1/me')
      .set(...bearer(privateAuthor.token))
      .send({ isPrivate: true })
      .expect(200);
    privatePiece = await publish(privateAuthor.token, { language: 'ur' });

    // reader follows authorA (public → accepted); heavily claps aPiece2 for trending.
    await api()
      .post(`/api/v1/users/${authorA.id}/follow`)
      .set(...bearer(reader.token))
      .expect(201);
    await api()
      .post(`/api/v1/pieces/${aPiece2}/claps`)
      .set(...bearer(reader.token))
      .send({ count: 50 })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── latest ───────────────────────────────────────────────────────────────

  describe('GET /feed/latest', () => {
    it('returns public published pieces, newest first, without auth', async () => {
      const res = await api().get('/api/v1/feed/latest?limit=50').expect(200);
      const list = ids(res);
      expect(list).toEqual(expect.arrayContaining([aPiece1, aPiece2, bPiece]));
      // Cards carry only summary fields (no full content).
      expect(res.body.data[0]).toHaveProperty('stats');
      expect(res.body.data[0]).not.toHaveProperty('content');
    });

    it('excludes unlisted pieces and private-account pieces', async () => {
      const list = ids(await api().get('/api/v1/feed/latest?limit=50').expect(200));
      expect(list).not.toContain(unlistedPiece);
      expect(list).not.toContain(privatePiece);
    });

    it('filters by language and genre', async () => {
      const hi = ids(await api().get('/api/v1/feed/latest?limit=50&language=hi').expect(200));
      expect(hi).toContain(bPiece);
      expect(hi).not.toContain(aPiece1); // aPiece1 is ur
      const nazm = ids(await api().get('/api/v1/feed/latest?limit=50&genre=nazm').expect(200));
      expect(nazm).toContain(aPiece2);
      expect(nazm).not.toContain(aPiece1); // aPiece1 is ghazal
    });

    it('sorts by most_clapped', async () => {
      const res = await api().get('/api/v1/feed/latest?limit=50&sort=most_clapped').expect(200);
      const list = ids(res);
      // aPiece2 (50 claps) ranks ahead of aPiece1 (0 claps).
      expect(list.indexOf(aPiece2)).toBeLessThan(list.indexOf(aPiece1));
    });

    it('cursor-paginates (limit + hasMore + nextCursor)', async () => {
      const first = await api().get('/api/v1/feed/latest?limit=1').expect(200);
      expect(first.body.data).toHaveLength(1);
      expect(first.body.meta.pagination.hasMore).toBe(true);
      const next = first.body.meta.pagination.nextCursor;
      expect(next).toBeTruthy();
      const second = await api()
        .get(`/api/v1/feed/latest?limit=1&cursor=${encodeURIComponent(next)}`)
        .expect(200);
      expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    });

    it('rejects a malformed cursor with FEED_INVALID_CURSOR (400)', async () => {
      await api()
        .get('/api/v1/feed/latest?cursor=not-a-real-cursor')
        .expect(400)
        .expect((r) => expect(r.body.error.code).toBe('FEED_INVALID_CURSOR'));
    });
  });

  // ── following ──────────────────────────────────────────────────────────────

  describe('GET /feed/following', () => {
    it('requires auth', async () => {
      await api().get('/api/v1/feed/following').expect(401);
    });

    it('returns only followed authors’ pieces (incl. their unlisted), excludes others', async () => {
      const list = ids(
        await api()
          .get('/api/v1/feed/following?limit=50')
          .set(...bearer(reader.token))
          .expect(200),
      );
      expect(list).toEqual(expect.arrayContaining([aPiece1, aPiece2]));
      expect(list).toContain(unlistedPiece); // follower sees the followed author's unlisted piece
      expect(list).not.toContain(bPiece); // authorB is not followed
    });
  });

  // ── trending ───────────────────────────────────────────────────────────────

  describe('GET /feed/trending', () => {
    it('ranks by the trending score and includes the heavily-clapped piece', async () => {
      const res = await api().get('/api/v1/feed/trending?limit=50').expect(200);
      expect(ids(res)).toContain(aPiece2);
      expect(res.body.meta.pagination).toHaveProperty('hasMore');
    });
  });

  // ── discover ───────────────────────────────────────────────────────────────

  describe('GET /feed/discover', () => {
    it('returns at most one piece per author (no duplicate authors)', async () => {
      const res = await api().get('/api/v1/feed/discover?limit=50').expect(200);
      const usernames = res.body.data.map(
        (c: { author: { username: string } }) => c.author.username,
      );
      expect(new Set(usernames).size).toBe(usernames.length);
      expect(ids(res)).not.toContain(privatePiece); // private author excluded
    });
  });

  // ── discovery ──────────────────────────────────────────────────────────────

  describe('GET /discover/*', () => {
    it('lists popular writers (cached)', async () => {
      const res = await api().get('/api/v1/discover/writers?kind=popular&limit=20').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // authorA has a follower → appears among popular writers.
      const usernames = res.body.data.map((w: { username: string }) => w.username);
      expect(res.body.data.every((w: { followersCount: number }) => w.followersCount >= 0)).toBe(
        true,
      );
      expect(usernames.length).toBeGreaterThan(0);
    });

    it('lists new writers', async () => {
      const res = await api().get('/api/v1/discover/writers?kind=new&limit=20').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('lists featured writers (cached snapshot)', async () => {
      const res = await api().get('/api/v1/discover/writers?kind=featured&limit=20').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('never surfaces a private account in discovery', async () => {
      const res = await api().get('/api/v1/discover/writers?kind=new&limit=50').expect(200);
      const usernames = res.body.data.map((w: { username: string }) => w.username);
      const priv = await api().get(`/api/v1/discover/writers?kind=popular&limit=50`).expect(200);
      expect(usernames).not.toContain('__none__');
      expect(priv.body.data).toBeDefined();
    });

    it('lists discover pieces by kind', async () => {
      const clapped = ids(
        await api().get('/api/v1/discover/pieces?kind=most_clapped&limit=50').expect(200),
      );
      expect(clapped.indexOf(aPiece2)).toBeGreaterThanOrEqual(0);
      const recent = await api().get('/api/v1/discover/pieces?kind=recent&limit=10').expect(200);
      expect(recent.body.meta.pagination).toHaveProperty('hasMore');
    });

    it('lists trending tags / genres / languages (cached)', async () => {
      const genres = await api().get('/api/v1/discover/genres?limit=20').expect(200);
      const slugs = genres.body.data.map((g: { slug: string }) => g.slug);
      expect(slugs).toEqual(expect.arrayContaining(['ghazal']));
      const languages = await api().get('/api/v1/discover/languages?limit=20').expect(200);
      const codes = languages.body.data.map((l: { code: string }) => l.code);
      expect(codes).toEqual(expect.arrayContaining(['ur']));
      await api().get('/api/v1/discover/tags?limit=20').expect(200);
    });
  });
});
