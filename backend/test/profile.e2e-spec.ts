import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Profile + follow + settings e2e (docs 05, docs 13 §4.2). Requires Postgres +
 * Redis + MinIO (`docker compose up -d`), migrations run, and taxonomy seeded
 * (`pnpm seed`). Tests run in order and share three users registered up front;
 * `X-Client: mobile` yields body tokens.
 */
describe('Profile & Follow (e2e)', () => {
  let app: INestApplication;
  let A: { id: string; token: string; username: string };
  let B: { id: string; token: string; username: string };
  let C: { id: string; token: string; username: string };
  let requestId: string;

  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];

  async function register(): Promise<{ id: string; token: string; username: string }> {
    const username = `p${randomBytes(5).toString('hex')}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'correct horse battery staple',
      })
      .expect(201);
    return { id: res.body.data.user.id, token: res.body.data.accessToken, username };
  }

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    A = await register();
    B = await register();
    C = await register();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /me auto-creates the profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(...bearer(A.token))
      .expect(200);
    expect(res.body.data.penName).toBe(A.username);
    expect(res.body.data.counts.followers).toBe(0);
  });

  it('rejects an unauthenticated /me (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });

  it('PATCH /me updates bio, genres, language', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set(...bearer(A.token))
      .send({ bio: 'Ghazal writer', genres: ['ghazal', 'nazm'], defaultLanguageCode: 'ur' })
      .expect(200);
    expect(res.body.data.bio).toBe('Ghazal writer');
    expect(res.body.data.genres.map((g: { slug: string }) => g.slug).sort()).toEqual([
      'ghazal',
      'nazm',
    ]);
    expect(res.body.data.defaultLanguageId).not.toBeNull();
  });

  it('rejects an unknown genre with GENRE_INVALID (422)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set(...bearer(A.token))
      .send({ genres: ['not-a-genre'] })
      .expect(422);
    expect(res.body.error.code).toBe('GENRE_INVALID');
  });

  it('B sees A’s public profile in full', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${A.username}`)
      .set(...bearer(B.token))
      .expect(200);
    expect(res.body.data.restricted).toBe(false);
    expect(res.body.data.bio).toBe('Ghazal writer');
  });

  it('B follows public A immediately (accepted) and counts update', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/users/${A.id}/follow`)
      .set(...bearer(B.token))
      .expect(201);
    expect(res.body.data.status).toBe('accepted');
    const view = await request(app.getHttpServer())
      .get(`/api/v1/users/${A.username}`)
      .set(...bearer(B.token))
      .expect(200);
    expect(view.body.data.viewerRelation.isFollowing).toBe(true);
    expect(view.body.data.counts.followers).toBe(1);
  });

  it('rejects self-follow (422)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${A.id}/follow`)
      .set(...bearer(A.token))
      .expect(422)
      .expect((r) => expect(r.body.error.code).toBe('USER_CANNOT_FOLLOW_SELF'));
  });

  it('A switches to private; C’s follow becomes a pending request', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set(...bearer(A.token))
      .send({ isPrivate: true })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/users/${A.id}/follow`)
      .set(...bearer(C.token))
      .expect(201);
    expect(res.body.data.status).toBe('pending');
  });

  it('shows an anonymous viewer a private teaser (bio hidden)', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/users/${A.username}`).expect(200);
    expect(res.body.data.restricted).toBe(true);
    expect(res.body.data.bio).toBeUndefined();
  });

  it('A lists incoming follow requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/follow-requests')
      .set(...bearer(A.token))
      .expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].requester.username).toBe(C.username);
    requestId = res.body.data[0].id;
  });

  it("rejects accepting someone else's request (404, no leak)", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/follow-requests/${requestId}/accept`)
      .set(...bearer(B.token))
      .expect(404);
  });

  it('A accepts C’s request; C then sees the full private profile', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/follow-requests/${requestId}/accept`)
      .set(...bearer(A.token))
      .expect(200);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${A.username}`)
      .set(...bearer(C.token))
      .expect(200);
    expect(res.body.data.restricted).toBe(false);
    expect(res.body.data.viewerRelation.isFollowing).toBe(true);
    expect(res.body.data.counts.followers).toBe(2);
  });

  it('followers list is cursor-paginated and privacy-gated', async () => {
    const ok = await request(app.getHttpServer())
      .get(`/api/v1/users/${A.username}/followers`)
      .set(...bearer(C.token))
      .expect(200);
    expect(ok.body.data.length).toBe(2);
    expect(ok.body.meta.pagination).toHaveProperty('hasMore');
    // Anonymous viewer of a private account's follower list is denied.
    await request(app.getHttpServer()).get(`/api/v1/users/${A.username}/followers`).expect(403);
  });

  it('GET/PATCH /settings persists the preference bag', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set(...bearer(A.token))
      .expect(200);
    const res = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set(...bearer(A.token))
      .send({ theme: 'dark', notificationPreferences: { newFollower: true } })
      .expect(200);
    expect(res.body.data.theme).toBe('dark');
    expect(res.body.data.notificationPreferences.newFollower).toBe(true);
  });

  it('uploads an avatar, validates it, and returns a storage key', async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    const res = await request(app.getHttpServer())
      .post('/api/v1/profile/avatar')
      .set(...bearer(A.token))
      .attach('file', png, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body.data.key).toMatch(/^profiles\/.*\/avatar-.*\.webp$/);
  });

  it('rejects a non-image avatar upload (415)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/profile/avatar')
      .set(...bearer(A.token))
      .attach('file', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' })
      .expect(415);
  });

  /**
   * B3 — `GET /users/by-id/:id`. Reachability, not just shape: every case hits the real route
   * through the real guard stack. State at this point: A is PRIVATE with B and C as accepted
   * followers; B is public.
   */
  describe('GET /users/by-id/:id (B3)', () => {
    it('returns the same profile as the username route for the same user', async () => {
      const byId = await request(app.getHttpServer())
        .get(`/api/v1/users/by-id/${A.id}`)
        .set(...bearer(C.token))
        .expect(200);
      const byUsername = await request(app.getHttpServer())
        .get(`/api/v1/users/${A.username}`)
        .set(...bearer(C.token))
        .expect(200);
      expect(byId.body.data).toEqual(byUsername.body.data);
      expect(byId.body.data.restricted).toBe(false);
      expect(byId.body.data.penName).toBeTruthy();
    });

    it('shows a stranger the SAME private teaser through both routes', async () => {
      const byId = await request(app.getHttpServer())
        .get(`/api/v1/users/by-id/${A.id}`)
        .set(...bearer(B.token))
        .expect(200);
      // B unfollows first so it is a stranger to the now-private A.
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${A.id}/follow`)
        .set(...bearer(B.token))
        .expect(204);
      const teaserById = await request(app.getHttpServer())
        .get(`/api/v1/users/by-id/${A.id}`)
        .set(...bearer(B.token))
        .expect(200);
      const teaserByUsername = await request(app.getHttpServer())
        .get(`/api/v1/users/${A.username}`)
        .set(...bearer(B.token))
        .expect(200);
      expect(byId.body.data.restricted).toBe(false); // was a follower a moment ago
      expect(teaserById.body.data.restricted).toBe(true);
      expect(teaserById.body.data.bio).toBeUndefined();
      expect(teaserById.body.data).toEqual(teaserByUsername.body.data);
    });

    it('serves a signed-out viewer the public view (OptionalAuthGuard path)', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/users/by-id/${B.id}`).expect(200);
      expect(res.body.data.restricted).toBe(false);
      expect(res.body.data.username).toBe(B.username);
      expect(res.body.data.viewerRelation.isSelf).toBe(false);
    });

    it('404s an unknown id with the same error code as the username route', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000000';
      const byId = await request(app.getHttpServer())
        .get(`/api/v1/users/by-id/${unknownId}`)
        .expect(404);
      const byUsername = await request(app.getHttpServer())
        .get('/api/v1/users/definitely-no-such-user')
        .expect(404);
      expect(byId.body.error.code).toBe('USER_NOT_FOUND');
      expect(byId.body.error.code).toBe(byUsername.body.error.code);
    });

    it('rejects a non-UUID id with 400 (ParseUUIDPipe), not a 500', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/by-id/not-a-uuid')
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });
});
