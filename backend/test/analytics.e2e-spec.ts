import type { INestApplication } from '@nestjs/common';
import { Role } from '@qalam/shared';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { PermissionsService } from '../src/modules/permissions/permissions.service';
import { RolesService } from '../src/modules/users/roles.service';
import { RedisService } from '../src/redis/redis.service';
import { createTestApp } from './utils/create-test-app';

interface TestUser {
  id: string;
  token: string;
  email: string;
}

/**
 * Analytics & Insights e2e (E10). Requires Postgres + Redis, migrations + seeds.
 * Covers event-driven aggregation (view/read tracking → aggregates), writer /
 * piece / reader / platform / trending analytics, snapshots, and authorization.
 */
describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let reader: TestUser;
  let admin: TestUser;
  let adminToken: string;
  const PASSWORD = 'correct horse battery staple';

  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const api = () => request(app.getHttpServer());
  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'words' }] }],
  };

  async function register(): Promise<TestUser> {
    await app.get(RedisService).getClient('rateLimit').flushdb();
    const username = `an${randomBytes(5).toString('hex')}`;
    const email = `${username}@ex.com`;
    const res = await api()
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({ email, username, password: PASSWORD })
      .expect(201);
    return { id: res.body.data.user.id, token: res.body.data.accessToken, email };
  }

  async function login(email: string): Promise<string> {
    await app.get(RedisService).getClient('rateLimit').flushdb();
    const res = await api()
      .post('/api/v1/auth/login')
      .set('X-Client', 'mobile')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.data.accessToken;
  }

  async function publish(token: string): Promise<string> {
    const draft = await api()
      .post('/api/v1/pieces')
      .set(...bearer(token))
      .send({
        title: 'Piece',
        content: doc,
        languageCode: 'ur',
        genreSlug: 'ghazal',
        visibility: 'public',
      })
      .expect(201);
    const id = draft.body.data.id;
    await api()
      .post(`/api/v1/pieces/${id}/publish`)
      .set(...bearer(token))
      .expect(200);
    return id;
  }

  async function freshAuthorWithPiece(): Promise<{ author: TestUser; pieceId: string }> {
    const author = await register();
    const pieceId = await publish(author.token);
    return { author, pieceId };
  }

  const view = (pieceId: string, opts: { token?: string; sessionId?: string } = {}) => {
    const req = api().post(`/api/v1/analytics/pieces/${pieceId}/view`);
    if (opts.token !== undefined) req.set(...bearer(opts.token));
    return req.send({ sessionId: opts.sessionId }).expect(204);
  };
  const read = (
    pieceId: string,
    opts: { token?: string; durationSeconds: number; completionPct: number },
  ) => {
    const req = api().post(`/api/v1/analytics/pieces/${pieceId}/read`);
    if (opts.token !== undefined) req.set(...bearer(opts.token));
    return req
      .send({ durationSeconds: opts.durationSeconds, completionPct: opts.completionPct })
      .expect(204);
  };
  const pieceAnalytics = (pieceId: string, token: string) =>
    api()
      .get(`/api/v1/analytics/pieces/${pieceId}`)
      .set(...bearer(token));

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    await app.get(RedisService).getClient('cache').flushdb();
    await app.get(RolesService).seedRoles();
    await app.get(PermissionsService).seed();

    reader = await register();
    admin = await register();
    await app.get(RolesService).grantRole(admin.id, Role.Admin, null);
    adminToken = await login(admin.email);
  });

  afterEach(async () => {
    await app.get(RedisService).getClient('rateLimit').flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── View tracking ──────────────────────────────────────────────────────────

  describe('view tracking', () => {
    it('counts views + unique views and de-dupes a repeat viewer within cooldown', async () => {
      const { author, pieceId } = await freshAuthorWithPiece();
      await view(pieceId, { token: reader.token }); // unique viewer #1
      await view(pieceId, { token: reader.token }); // repeat → deduped
      await view(pieceId, { sessionId: 'anon-abc' }); // unique viewer #2 (anon)

      const res = await pieceAnalytics(pieceId, author.token).expect(200);
      expect(res.body.data.views).toBe(2);
      expect(res.body.data.uniqueViews).toBe(2);
    });
  });

  // ── Read tracking ──────────────────────────────────────────────────────────

  describe('read tracking', () => {
    it('records reads, completion rate, and average read time', async () => {
      const { author, pieceId } = await freshAuthorWithPiece();
      await view(pieceId, { token: reader.token });
      await read(pieceId, { token: reader.token, durationSeconds: 90, completionPct: 80 });

      const res = await pieceAnalytics(pieceId, author.token).expect(200);
      expect(res.body.data.reads).toBe(1);
      expect(res.body.data.averageReadTimeSeconds).toBe(90);
      expect(res.body.data.completionRate).toBe(1); // 1 completed / 1 view
    });

    it('updates the reader’s own analytics (pieces read, streak, completed)', async () => {
      const { pieceId } = await freshAuthorWithPiece();
      await read(pieceId, { token: reader.token, durationSeconds: 120, completionPct: 90 });

      const res = await api()
        .get('/api/v1/analytics/readers/me')
        .set(...bearer(reader.token))
        .expect(200);
      expect(res.body.data.piecesRead).toBeGreaterThanOrEqual(1);
      expect(res.body.data.completedReads).toBeGreaterThanOrEqual(1);
      expect(res.body.data.currentStreak).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Writer analytics ───────────────────────────────────────────────────────

  describe('writer analytics', () => {
    it('aggregates the writer’s views/reads/published + most popular piece', async () => {
      const { author, pieceId } = await freshAuthorWithPiece();
      await view(pieceId, { token: reader.token });
      await read(pieceId, { token: reader.token, durationSeconds: 60, completionPct: 70 });

      const res = await api()
        .get('/api/v1/analytics/me')
        .set(...bearer(author.token))
        .expect(200);
      expect(res.body.data.piecesPublished).toBe(1);
      expect(res.body.data.totalViews).toBe(1);
      expect(res.body.data.reads).toBe(1);
      expect(res.body.data.mostPopularPiece?.pieceId).toBe(pieceId);
    });

    it('exposes a combined dashboard', async () => {
      const res = await api()
        .get('/api/v1/analytics/dashboard')
        .set(...bearer(reader.token))
        .expect(200);
      expect(res.body.data).toHaveProperty('writer');
      expect(res.body.data).toHaveProperty('reader');
    });
  });

  // ── Trending ─────────────────────────────────────────────────────────────

  describe('trending', () => {
    it('ranks recently-viewed pieces', async () => {
      const { pieceId } = await freshAuthorWithPiece();
      await view(pieceId, { sessionId: 'trend-1' });
      await view(pieceId, { sessionId: 'trend-2' });
      await app.get(RedisService).getClient('cache').flushdb(); // fresh compute

      const res = await api()
        .get('/api/v1/analytics/trending?type=pieces&period=daily')
        .expect(200);
      const keys = res.body.data.pieces.map((p: { key: string }) => p.key);
      expect(keys).toContain(pieceId);
    });
  });

  // ── Platform (admin) ─────────────────────────────────────────────────────

  describe('platform analytics', () => {
    it('is forbidden for a normal user (403 AUTH_PERMISSION_DENIED)', async () => {
      await api()
        .get('/api/v1/analytics/platform')
        .set(...bearer(reader.token))
        .expect(403)
        .expect((r) => expect(r.body.error.code).toBe('AUTH_PERMISSION_DENIED'));
    });

    it('returns platform totals for an admin', async () => {
      await app.get(RedisService).getClient('cache').flushdb();
      const res = await api()
        .get('/api/v1/analytics/platform')
        .set(...bearer(adminToken))
        .expect(200);
      expect(res.body.data.totalUsers).toBeGreaterThan(0);
      expect(res.body.data.publishedPieces).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.topGenres)).toBe(true);
    });
  });

  // ── Snapshots + growth ─────────────────────────────────────────────────────

  describe('snapshots', () => {
    it('generates snapshots and serves platform + writer growth', async () => {
      const { author, pieceId } = await freshAuthorWithPiece();
      await view(pieceId, { token: reader.token });

      const gen = await api()
        .post('/api/v1/analytics/snapshots')
        .set(...bearer(adminToken))
        .send({ period: 'daily' })
        .expect(201);
      expect(gen.body.data.snapshotsWritten).toBeGreaterThan(0);

      const platformGrowth = await api()
        .get('/api/v1/analytics/platform/growth?period=daily')
        .set(...bearer(adminToken))
        .expect(200);
      expect(platformGrowth.body.data.points.length).toBeGreaterThan(0);

      const writerGrowth = await api()
        .get('/api/v1/analytics/me/growth?period=daily')
        .set(...bearer(author.token))
        .expect(200);
      expect(writerGrowth.body.data.points.length).toBeGreaterThan(0);
    });

    it('snapshot generation is admin-only', async () => {
      await api()
        .post('/api/v1/analytics/snapshots')
        .set(...bearer(reader.token))
        .send({ period: 'daily' })
        .expect(403);
    });
  });

  // ── Authorization ─────────────────────────────────────────────────────────

  describe('authorization', () => {
    it('requires auth for own analytics', async () => {
      await api().get('/api/v1/analytics/me').expect(401);
    });

    it('piece analytics are owner-only (403) and 404 for a missing piece', async () => {
      const { pieceId } = await freshAuthorWithPiece();
      await api()
        .get(`/api/v1/analytics/pieces/${pieceId}`)
        .set(...bearer(reader.token))
        .expect(403)
        .expect((r) => expect(r.body.error.code).toBe('PIECE_FORBIDDEN'));

      await api()
        .get('/api/v1/analytics/pieces/00000000-0000-7000-8000-000000000000')
        .set(...bearer(reader.token))
        .expect(404);
    });
  });
});
