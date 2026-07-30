import type { INestApplication } from '@nestjs/common';
import { Role } from '@qalam/shared';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { RolesService } from '../src/modules/users/roles.service';
import { createTestApp } from './utils/create-test-app';

interface TestUser {
  id: string;
  token: string;
  username: string;
  email: string;
}

/**
 * Notification Engine e2e (docs 18 E9). Requires Postgres + Redis, migrations
 * run, roles + taxonomy seeded. Covers event-driven creation (follow/comment/
 * reply/clap/like/mention/response), preferences, unread count + cache, read/
 * mark-all/archive/delete, cursor pagination, authorization, and admin system
 * broadcasts.
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct horse battery staple';

  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const api = () => request(app.getHttpServer());

  const doc = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  const mentionDoc = (userId: string) => ({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'hey ' },
          { type: 'mention', attrs: { userId, label: '@friend' } },
        ],
      },
    ],
  });

  async function register(): Promise<TestUser> {
    await app.get(RedisService).getClient('rateLimit').flushdb();
    const username = `n${randomBytes(5).toString('hex')}`;
    const email = `${username}@ex.com`;
    const res = await api()
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({ email, username, password: PASSWORD })
      .expect(201);
    return { id: res.body.data.user.id, token: res.body.data.accessToken, username, email };
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

  async function makePrivate(user: TestUser): Promise<void> {
    await api()
      .patch('/api/v1/me')
      .set(...bearer(user.token))
      .send({ isPrivate: true })
      .expect(200);
  }

  async function publish(
    token: string,
    opts: { title?: string; content?: unknown } = {},
  ): Promise<string> {
    const draft = await api()
      .post('/api/v1/pieces')
      .set(...bearer(token))
      .send({
        title: opts.title ?? 'A Piece',
        content: opts.content ?? doc('some words here'),
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

  const inbox = async (token: string, qs = ''): Promise<request.Response> =>
    api()
      .get(`/api/v1/notifications${qs}`)
      .set(...bearer(token))
      .expect(200);
  const types = (res: request.Response): string[] =>
    res.body.data.map((n: { type: string }) => n.type);
  const unread = async (token: string): Promise<number> =>
    (
      await api()
        .get('/api/v1/notifications/unread-count')
        .set(...bearer(token))
        .expect(200)
    ).body.data.count;

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    await app.get(RedisService).getClient('cache').flushdb();
    await app.get(RolesService).seedRoles();
  });

  afterEach(async () => {
    await app.get(RedisService).getClient('rateLimit').flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Event-driven creation ────────────────────────────────────────────────

  describe('notification events', () => {
    it('new follower notifies the followee', async () => {
      const author = await register();
      const follower = await register();
      await api()
        .post(`/api/v1/users/${author.id}/follow`)
        .set(...bearer(follower.token))
        .expect(201);

      const res = await inbox(author.token);
      const followNote = res.body.data.find((n: { type: string }) => n.type === 'follow');
      expect(followNote).toBeDefined();
      expect(followNote.actor.username).toBe(follower.username);
      expect(followNote.status).toBe('unread');
    });

    it('follow request (private account) notifies the target, and acceptance notifies the requester', async () => {
      const target = await register();
      await makePrivate(target);
      const requester = await register();

      await api()
        .post(`/api/v1/users/${target.id}/follow`)
        .set(...bearer(requester.token))
        .expect(201);
      expect(types(await inbox(target.token))).toContain('follow_request');

      const requests = await api()
        .get('/api/v1/me/follow-requests')
        .set(...bearer(target.token))
        .expect(200);
      const followId = requests.body.data[0].id;
      await api()
        .patch(`/api/v1/follow-requests/${followId}/accept`)
        .set(...bearer(target.token))
        .expect(200);

      expect(types(await inbox(requester.token))).toContain('follow_accepted');
    });

    it('a comment notifies the piece author; a reply notifies the parent commenter', async () => {
      const author = await register();
      const commenter = await register();
      const piece = await publish(author.token);

      const comment = await api()
        .post(`/api/v1/pieces/${piece}/comments`)
        .set(...bearer(commenter.token))
        .send({ body: 'lovely piece' })
        .expect(201);
      expect(types(await inbox(author.token))).toContain('comment');

      await api()
        .post(`/api/v1/comments/${comment.body.data.id}/replies`)
        .set(...bearer(author.token))
        .send({ body: 'thank you' })
        .expect(201);
      expect(types(await inbox(commenter.token))).toContain('comment_reply');
    });

    it('claps notify the author once (dedup), and likes notify the author', async () => {
      const author = await register();
      const fan = await register();
      const piece = await publish(author.token);

      await api()
        .post(`/api/v1/pieces/${piece}/claps`)
        .set(...bearer(fan.token))
        .send({ count: 3 })
        .expect(200);
      await api()
        .post(`/api/v1/pieces/${piece}/claps`)
        .set(...bearer(fan.token))
        .send({ count: 2 })
        .expect(200);
      await api()
        .post(`/api/v1/pieces/${piece}/likes`)
        .set(...bearer(fan.token))
        .expect(200);

      const res = await inbox(author.token, '?limit=50');
      const claps = res.body.data.filter((n: { type: string }) => n.type === 'clap');
      expect(claps).toHaveLength(1); // dedup: repeated claps → one notification
      expect(types(res)).toContain('like');
    });

    it('does not notify a user of their own actions', async () => {
      const author = await register();
      const piece = await publish(author.token);
      await api()
        .post(`/api/v1/pieces/${piece}/comments`)
        .set(...bearer(author.token))
        .send({ body: 'my own note' })
        .expect(201);
      expect(types(await inbox(author.token))).not.toContain('comment');
    });

    it('mentions in a comment body notify the mentioned user', async () => {
      const author = await register();
      const commenter = await register();
      const mentioned = await register();
      const piece = await publish(author.token);

      await api()
        .post(`/api/v1/pieces/${piece}/comments`)
        .set(...bearer(commenter.token))
        .send({ body: `hello @${mentioned.username} look at this` })
        .expect(201);

      expect(types(await inbox(mentioned.token))).toContain('mention');
    });

    it('mentions in a published piece notify the mentioned user', async () => {
      const author = await register();
      const mentioned = await register();
      await publish(author.token, { title: 'With a mention', content: mentionDoc(mentioned.id) });

      expect(types(await inbox(mentioned.token))).toContain('mention');
    });
  });

  // ── Unread count + cache ────────────────────────────────────────────────

  describe('unread count', () => {
    it('tracks unread accurately across creation and invalidates the cache', async () => {
      const recipient = await register();
      const a = await register();
      const b = await register();

      expect(await unread(recipient.token)).toBe(0);
      await api()
        .post(`/api/v1/users/${recipient.id}/follow`)
        .set(...bearer(a.token))
        .expect(201);
      expect(await unread(recipient.token)).toBe(1); // cached
      await api()
        .post(`/api/v1/users/${recipient.id}/follow`)
        .set(...bearer(b.token))
        .expect(201);
      expect(await unread(recipient.token)).toBe(2); // cache invalidated + recomputed
    });
  });

  // ── Read / archive / delete ─────────────────────────────────────────────

  describe('read operations', () => {
    async function seedOne(): Promise<{ recipient: TestUser; notificationId: string }> {
      const recipient = await register();
      const actor = await register();
      await api()
        .post(`/api/v1/users/${recipient.id}/follow`)
        .set(...bearer(actor.token))
        .expect(201);
      const res = await inbox(recipient.token);
      return { recipient, notificationId: res.body.data[0].id };
    }

    it('marks one notification read', async () => {
      const { recipient, notificationId } = await seedOne();
      await api()
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set(...bearer(recipient.token))
        .expect(204);
      expect(await unread(recipient.token)).toBe(0);
      const res = await inbox(recipient.token);
      expect(res.body.data[0].status).toBe('read');
    });

    it('marks all read', async () => {
      const { recipient } = await seedOne();
      await api()
        .patch('/api/v1/notifications/read-all')
        .set(...bearer(recipient.token))
        .expect(204);
      expect(await unread(recipient.token)).toBe(0);
    });

    it('archives a notification (out of the active inbox + unread count, into ?status=archived)', async () => {
      const { recipient, notificationId } = await seedOne();
      await api()
        .patch(`/api/v1/notifications/${notificationId}/archive`)
        .set(...bearer(recipient.token))
        .expect(204);
      expect(await unread(recipient.token)).toBe(0);
      const active = await inbox(recipient.token);
      expect(active.body.data.map((n: { id: string }) => n.id)).not.toContain(notificationId);
      const archived = await inbox(recipient.token, '?status=archived');
      expect(archived.body.data.map((n: { id: string }) => n.id)).toContain(notificationId);
    });

    it('soft-deletes a notification (gone from the inbox)', async () => {
      const { recipient, notificationId } = await seedOne();
      await api()
        .delete(`/api/v1/notifications/${notificationId}`)
        .set(...bearer(recipient.token))
        .expect(204);
      const res = await inbox(recipient.token, '?limit=50');
      expect(res.body.data.map((n: { id: string }) => n.id)).not.toContain(notificationId);
    });

    it('cursor-paginates newest first', async () => {
      const recipient = await register();
      const a = await register();
      const b = await register();
      await api()
        .post(`/api/v1/users/${recipient.id}/follow`)
        .set(...bearer(a.token))
        .expect(201);
      await api()
        .post(`/api/v1/users/${recipient.id}/follow`)
        .set(...bearer(b.token))
        .expect(201);

      const first = await inbox(recipient.token, '?limit=1');
      expect(first.body.data).toHaveLength(1);
      expect(first.body.meta.pagination.hasMore).toBe(true);
      const next = first.body.meta.pagination.nextCursor;
      const second = await inbox(recipient.token, `?limit=1&cursor=${encodeURIComponent(next)}`);
      expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    });

    it('rejects a malformed cursor with FEED_INVALID_CURSOR (400)', async () => {
      const recipient = await register();
      await api()
        .get('/api/v1/notifications?cursor=not-a-cursor')
        .set(...bearer(recipient.token))
        .expect(400)
        .expect((r) => expect(r.body.error.code).toBe('FEED_INVALID_CURSOR'));
    });
  });

  // ── Preferences ─────────────────────────────────────────────────────────

  describe('preferences', () => {
    it('disabling a category suppresses those notifications', async () => {
      const author = await register();
      const fan = await register();
      const piece = await publish(author.token);

      await api()
        .patch('/api/v1/notification-preferences')
        .set(...bearer(author.token))
        .send({ reaction: false })
        .expect(200)
        .expect((r) => expect(r.body.data.reaction).toBe(false));

      await api()
        .post(`/api/v1/pieces/${piece}/likes`)
        .set(...bearer(fan.token))
        .expect(200);
      expect(types(await inbox(author.token))).not.toContain('like');
    });

    it('returns the resolved preferences (defaults all on)', async () => {
      const user = await register();
      const res = await api()
        .get('/api/v1/notification-preferences')
        .set(...bearer(user.token))
        .expect(200);
      expect(res.body.data).toEqual({
        follow: true,
        comment: true,
        reply: true,
        reaction: true,
        mention: true,
        response: true,
        system: true,
      });
    });
  });

  // ── Authorization ─────────────────────────────────────────────────────────

  describe('authorization', () => {
    it('requires authentication to list notifications', async () => {
      await api().get('/api/v1/notifications').expect(401);
    });

    it('a user cannot mutate another user’s notification (404, not 403)', async () => {
      const owner = await register();
      const actor = await register();
      const intruder = await register();
      await api()
        .post(`/api/v1/users/${owner.id}/follow`)
        .set(...bearer(actor.token))
        .expect(201);
      const id = (await inbox(owner.token)).body.data[0].id;

      await api()
        .patch(`/api/v1/notifications/${id}/read`)
        .set(...bearer(intruder.token))
        .expect(404)
        .expect((r) => expect(r.body.error.code).toBe('NOTIFICATION_NOT_FOUND'));
    });

    it('only admins can create system notifications; they broadcast to users', async () => {
      const recipient = await register();
      const normal = await register();
      const adminUser = await register();
      await app.get(RolesService).grantRole(adminUser.id, Role.Admin, null);
      const adminToken = await login(adminUser.email);

      // Non-admin is forbidden.
      await api()
        .post('/api/v1/admin/system-notifications')
        .set(...bearer(normal.token))
        .send({ title: 'Nope', body: 'blocked' })
        .expect(403);

      // Admin creates + broadcasts.
      const created = await api()
        .post('/api/v1/admin/system-notifications')
        .set(...bearer(adminToken))
        .send({ title: 'Maintenance', body: 'Back at 2am' })
        .expect(201);
      expect(created.body.data.deliveredCount).toBeGreaterThan(0);

      // The recipient received a system notification.
      expect(types(await inbox(recipient.token, '?limit=50'))).toContain('system');
    });
  });
});
