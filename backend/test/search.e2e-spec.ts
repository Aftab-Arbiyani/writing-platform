import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Search & Discovery e2e (docs 18 E8). Requires Postgres + Redis, migrations run,
 * taxonomy seeded (languages hi/ur/en, genres ghazal/nazm). Covers global,
 * piece, writer, tag, genre and language search; autocomplete; trending; recent
 * searches; ranking; cursor pagination; and the authorization rules (unlisted +
 * private-account exclusion, private-writer teaser).
 */
describe('Search (e2e)', () => {
  let app: INestApplication;
  let meera: { id: string; token: string };
  let arjun: { id: string; token: string };
  let sana: { id: string; token: string };
  let reader: { id: string; token: string };

  let p1: string; // Meera — "Raat Ki Baarish" (ur/ghazal, tags barish,raat)
  let p2: string; // Meera — "Dhoop Aur Chaon" (hi/nazm, tag dhoop)
  let p3: string; // Arjun — "Barish Ki Kahani" (ur/ghazal, tag barish)
  let unlistedPiece: string; // Meera — unlisted
  let privatePiece: string; // Sana (private account) — public visibility

  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const api = () => request(app.getHttpServer());
  const doc = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  const ids = (res: request.Response): string[] => res.body.data.map((c: { id: string }) => c.id);

  async function register(): Promise<{ id: string; token: string }> {
    await app.get(RedisService).getClient('rateLimit').flushdb();
    const username = `s${randomBytes(5).toString('hex')}`;
    const res = await api()
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({ email: `${username}@ex.com`, username, password: 'correct horse battery staple' })
      .expect(201);
    return { id: res.body.data.user.id, token: res.body.data.accessToken };
  }

  async function setProfile(token: string, body: Record<string, unknown>): Promise<void> {
    await api()
      .patch('/api/v1/me')
      .set(...bearer(token))
      .send(body)
      .expect(200);
  }

  async function publish(
    token: string,
    opts: {
      title: string;
      subtitle?: string;
      featuredQuote?: string;
      body?: string;
      language?: string;
      genre?: string;
      tags?: string[];
      visibility?: 'public' | 'unlisted';
    },
  ): Promise<string> {
    const draft = await api()
      .post('/api/v1/pieces')
      .set(...bearer(token))
      .send({
        title: opts.title,
        subtitle: opts.subtitle,
        featuredQuote: opts.featuredQuote,
        content: doc(opts.body ?? opts.title),
        languageCode: opts.language ?? 'ur',
        genreSlug: opts.genre ?? 'ghazal',
        tags: opts.tags,
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

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    await app.get(RedisService).getClient('cache').flushdb();

    meera = await register();
    arjun = await register();
    sana = await register();
    reader = await register();

    await setProfile(meera.token, {
      penName: 'Meera Kumari',
      bio: 'monsoon writer of ghazals',
      defaultLanguageCode: 'ur',
      genres: ['ghazal'],
    });
    await setProfile(arjun.token, {
      penName: 'Arjun Poet',
      bio: 'prose writer of stories',
      defaultLanguageCode: 'hi',
      genres: ['nazm'],
    });
    await setProfile(sana.token, {
      penName: 'Sana Ghost',
      bio: 'secret private diary',
      isPrivate: true,
    });

    p1 = await publish(meera.token, {
      title: 'Raat Ki Baarish',
      subtitle: 'Monsoon nights',
      featuredQuote: 'the rain washed the whole city',
      body: 'baarish ki nazm yahan',
      language: 'ur',
      genre: 'ghazal',
      tags: ['barish', 'raat'],
    });
    p2 = await publish(meera.token, {
      title: 'Dhoop Aur Chaon',
      body: 'dhoop ki baat',
      language: 'hi',
      genre: 'nazm',
      tags: ['dhoop'],
    });
    p3 = await publish(arjun.token, {
      title: 'Barish Ki Kahani',
      body: 'barish ki kahani yahan',
      language: 'ur',
      genre: 'ghazal',
      tags: ['barish'],
    });
    unlistedPiece = await publish(meera.token, {
      title: 'Barish Hidden Unlisted',
      tags: ['barish'],
      visibility: 'unlisted',
    });
    privatePiece = await publish(sana.token, {
      title: 'Barish Secret Private',
      tags: ['barish'],
      visibility: 'public',
    });

    // Reader searches a few terms so recent history + trending keywords exist.
    await api()
      .get('/api/v1/search?q=barish')
      .set(...bearer(reader.token))
      .expect(200);
    await api()
      .get('/api/v1/search/pieces?q=raat')
      .set(...bearer(reader.token))
      .expect(200);

    // Fresh caches so trending/autocomplete recompute against the seeded data.
    await app.get(RedisService).getClient('cache').flushdb();
  });

  afterEach(async () => {
    // Search endpoints are rate-limited (30/min); reset between tests to avoid flakiness.
    await app.get(RedisService).getClient('rateLimit').flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Global search ──────────────────────────────────────────────────────────

  describe('GET /search', () => {
    it('returns grouped results for a query', async () => {
      // limit=50 so both target pieces appear regardless of other pieces the
      // shared test DB has accumulated (the default 5-per-group preview ranks by
      // relevance, where a tag-only match can be crowded out by title matches).
      const res = await api().get('/api/v1/search?q=barish&limit=50').expect(200);
      const groups = res.body.data;
      expect(groups).toHaveProperty('writers');
      expect(groups).toHaveProperty('pieces');
      expect(groups).toHaveProperty('tags');
      expect(groups).toHaveProperty('genres');
      expect(groups).toHaveProperty('languages');
      const pieceIds = groups.pieces.map((p: { id: string }) => p.id);
      expect(pieceIds).toEqual(expect.arrayContaining([p1, p3]));
      expect(groups.tags.map((t: { slug: string }) => t.slug)).toContain('barish');
    });

    it('narrows to a single group with ?type=', async () => {
      const res = await api().get('/api/v1/search?q=barish&type=tags').expect(200);
      expect(res.body.data.pieces).toEqual([]);
      expect(res.body.data.writers).toEqual([]);
      expect(res.body.data.tags.length).toBeGreaterThan(0);
    });

    it('rejects a too-short query with SEARCH_QUERY_TOO_SHORT (400)', async () => {
      await api()
        .get('/api/v1/search?q=a')
        .expect(400)
        .expect((r) => expect(r.body.error.code).toBe('SEARCH_QUERY_TOO_SHORT'));
    });
  });

  // ── Piece search ─────────────────────────────────────────────────────────

  describe('GET /search/pieces', () => {
    it('matches by title/tag and excludes unlisted + private-account pieces', async () => {
      const res = await api().get('/api/v1/search/pieces?q=barish&limit=50').expect(200);
      const list = ids(res);
      expect(list).toEqual(expect.arrayContaining([p1, p3]));
      expect(list).not.toContain(unlistedPiece);
      expect(list).not.toContain(privatePiece);
      // Cards carry summary fields + a relevance rank, never full content.
      expect(res.body.data[0]).toHaveProperty('stats');
      expect(res.body.data[0]).toHaveProperty('rank');
      expect(res.body.data[0]).not.toHaveProperty('content');
    });

    it('matches by content text', async () => {
      const list = ids(await api().get('/api/v1/search/pieces?q=kahani&limit=50').expect(200));
      expect(list).toContain(p3);
    });

    it('matches by featured quote (not in the FTS vector)', async () => {
      const list = ids(await api().get('/api/v1/search/pieces?q=washed&limit=50').expect(200));
      expect(list).toContain(p1);
    });

    it('filters by language and genre', async () => {
      const hi = ids(
        await api().get('/api/v1/search/pieces?q=dhoop&language=hi&limit=50').expect(200),
      );
      expect(hi).toContain(p2);
      const ur = ids(
        await api().get('/api/v1/search/pieces?q=barish&language=ur&limit=50').expect(200),
      );
      expect(ur).toEqual(expect.arrayContaining([p1, p3]));
      expect(ur).not.toContain(p2); // p2 is hi
    });

    it('filters by author', async () => {
      const res = await api().get('/api/v1/search/pieces?q=barish&limit=50').expect(200);
      const arjunUsername = res.body.data.find((p: { id: string }) => p.id === p3)?.author.username;
      const byArjun = ids(
        await api()
          .get(`/api/v1/search/pieces?q=barish&author=${arjunUsername}&limit=50`)
          .expect(200),
      );
      expect(byArjun).toContain(p3);
      expect(byArjun).not.toContain(p1); // p1 is Meera's
    });

    it('cursor-paginates (limit + hasMore + nextCursor)', async () => {
      const first = await api()
        .get('/api/v1/search/pieces?q=barish&sort=latest&limit=1')
        .expect(200);
      expect(first.body.data).toHaveLength(1);
      expect(first.body.meta.pagination.hasMore).toBe(true);
      const next = first.body.meta.pagination.nextCursor;
      expect(next).toBeTruthy();
      const second = await api()
        .get(
          `/api/v1/search/pieces?q=barish&sort=latest&limit=1&cursor=${encodeURIComponent(next)}`,
        )
        .expect(200);
      expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    });

    it('rejects a malformed cursor with FEED_INVALID_CURSOR (400)', async () => {
      await api()
        .get('/api/v1/search/pieces?q=barish&cursor=not-a-cursor')
        .expect(400)
        .expect((r) => expect(r.body.error.code).toBe('FEED_INVALID_CURSOR'));
    });

    it('rejects an unknown language filter with LANGUAGE_INVALID (422)', async () => {
      await api()
        .get('/api/v1/search/pieces?q=barish&language=zz')
        .expect(422)
        .expect((r) => expect(r.body.error.code).toBe('LANGUAGE_INVALID'));
    });
  });

  // ── Writer search ────────────────────────────────────────────────────────

  describe('GET /search/writers', () => {
    it('finds public writers by pen name / bio', async () => {
      const res = await api().get('/api/v1/search/writers?q=writer&limit=50').expect(200);
      const usernames = res.body.data.map((w: { username: string }) => w.username);
      expect(usernames.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0]).toHaveProperty('rank');
    });

    it('returns a private account as a findable teaser (no bio)', async () => {
      const res = await api().get('/api/v1/search/writers?q=sana&limit=50').expect(200);
      const sanaRow = res.body.data.find((w: { userId: string }) => w.userId === sana.id);
      expect(sanaRow).toBeDefined();
      expect(sanaRow.isPrivate).toBe(true);
      expect(sanaRow.bio).toBeNull();
    });

    it('never matches a private account by its bio', async () => {
      const res = await api().get('/api/v1/search/writers?q=secret&limit=50').expect(200);
      const found = res.body.data.find((w: { userId: string }) => w.userId === sana.id);
      expect(found).toBeUndefined();
    });

    it('filters writers by language and genre', async () => {
      const urOnly = await api()
        .get('/api/v1/search/writers?q=writer&language=ur&limit=50')
        .expect(200);
      const urIds = urOnly.body.data.map((w: { userId: string }) => w.userId);
      expect(urIds).toContain(meera.id);
      expect(urIds).not.toContain(arjun.id); // arjun writes hi

      const ghazal = await api()
        .get('/api/v1/search/writers?q=writer&genre=ghazal&limit=50')
        .expect(200);
      const ghazalIds = ghazal.body.data.map((w: { userId: string }) => w.userId);
      expect(ghazalIds).toContain(meera.id);
      expect(ghazalIds).not.toContain(arjun.id); // arjun writes nazm
    });
  });

  // ── Tag / Genre / Language search ──────────────────────────────────────────

  describe('GET /search/tags · /genres · /languages', () => {
    it('finds tags with piece counts', async () => {
      const res = await api().get('/api/v1/search/tags?q=bar&limit=50').expect(200);
      const barish = res.body.data.find((t: { slug: string }) => t.slug === 'barish');
      expect(barish).toBeDefined();
      expect(barish.pieceCount).toBeGreaterThanOrEqual(1);
    });

    it('browses tags by popularity when q is omitted', async () => {
      const res = await api().get('/api/v1/search/tags?limit=50').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.pagination).toHaveProperty('hasMore');
    });

    it('finds genres with public-piece counts', async () => {
      const res = await api().get('/api/v1/search/genres?q=ghaz&limit=50').expect(200);
      const ghazal = res.body.data.find((g: { slug: string }) => g.slug === 'ghazal');
      expect(ghazal).toBeDefined();
      expect(ghazal.pieceCount).toBeGreaterThanOrEqual(2);
    });

    it('finds languages with public-piece counts', async () => {
      const res = await api().get('/api/v1/search/languages?q=urdu&limit=50').expect(200);
      const urdu = res.body.data.find((l: { code: string }) => l.code === 'ur');
      expect(urdu).toBeDefined();
      expect(urdu.pieceCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Autocomplete ───────────────────────────────────────────────────────────

  describe('GET /search/autocomplete', () => {
    it('suggests across writers, tags, genres, and piece titles', async () => {
      const res = await api().get('/api/v1/search/autocomplete?q=bar&limit=10').expect(200);
      expect(res.body.data).toHaveProperty('writers');
      expect(res.body.data.tags.map((t: { slug: string }) => t.slug)).toContain('barish');
    });

    it('completes a piece title by prefix', async () => {
      const res = await api().get('/api/v1/search/autocomplete?q=raat&type=pieces').expect(200);
      const titles = res.body.data.pieces.map((p: { title: string }) => p.title);
      expect(titles).toContain('Raat Ki Baarish');
    });

    it('caps each group at the requested limit', async () => {
      const res = await api().get('/api/v1/search/autocomplete?q=a&limit=10').expect(400); // q too short
      expect(res.body.error.code).toBe('SEARCH_QUERY_TOO_SHORT');
      const ok = await api().get('/api/v1/search/autocomplete?q=ba&limit=3').expect(200);
      expect(ok.body.data.tags.length).toBeLessThanOrEqual(3);
    });
  });

  // ── Trending ───────────────────────────────────────────────────────────────

  describe('GET /search/trending', () => {
    it('returns popular keywords, tags, genres, and writers', async () => {
      const res = await api().get('/api/v1/search/trending?limit=10').expect(200);
      expect(res.body.data).toHaveProperty('keywords');
      expect(res.body.data).toHaveProperty('tags');
      expect(res.body.data).toHaveProperty('genres');
      expect(res.body.data).toHaveProperty('writers');
      const keywords = res.body.data.keywords.map((k: { keyword: string }) => k.keyword);
      expect(keywords).toContain('barish'); // reader searched it in setup
    });
  });

  // ── Recent searches ──────────────────────────────────────────────────────

  describe('recent searches', () => {
    it('requires auth to list', async () => {
      await api().get('/api/v1/search/recent').expect(401);
    });

    it('lists the signed-in user’s recent searches, newest first', async () => {
      const res = await api()
        .get('/api/v1/search/recent')
        .set(...bearer(reader.token))
        .expect(200);
      const queries = res.body.data.map((r: { query: string }) => r.query);
      expect(queries).toEqual(expect.arrayContaining(['barish', 'raat']));
    });

    it('deletes one recent search', async () => {
      const list = await api()
        .get('/api/v1/search/recent')
        .set(...bearer(reader.token))
        .expect(200);
      const target = list.body.data[0];
      await api()
        .delete(`/api/v1/search/recent/${target.id}`)
        .set(...bearer(reader.token))
        .expect(204);
      const after = await api()
        .get('/api/v1/search/recent')
        .set(...bearer(reader.token))
        .expect(200);
      expect(after.body.data.map((r: { id: string }) => r.id)).not.toContain(target.id);
    });

    it('404s when deleting a non-existent recent search', async () => {
      await api()
        .delete('/api/v1/search/recent/00000000-0000-7000-8000-000000000000')
        .set(...bearer(reader.token))
        .expect(404)
        .expect((r) => expect(r.body.error.code).toBe('SEARCH_RECENT_NOT_FOUND'));
    });

    it('clears all recent searches', async () => {
      // Seed one, then clear.
      await api()
        .get('/api/v1/search?q=cleartest')
        .set(...bearer(reader.token))
        .expect(200);
      await api()
        .delete('/api/v1/search/recent')
        .set(...bearer(reader.token))
        .expect(204);
      const after = await api()
        .get('/api/v1/search/recent')
        .set(...bearer(reader.token))
        .expect(200);
      expect(after.body.data).toEqual([]);
    });
  });
});
