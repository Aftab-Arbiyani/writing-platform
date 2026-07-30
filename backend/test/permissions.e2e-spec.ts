import type { INestApplication } from '@nestjs/common';
import { Role } from '@qalam/shared';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { PermissionsService } from '../src/modules/permissions/permissions.service';
import { RolesService } from '../src/modules/users/roles.service';
import { createTestApp } from './utils/create-test-app';

interface TestUser {
  id: string;
  token: string;
  email: string;
}

/**
 * PBAC authorization e2e. Proves the permission guard end-to-end: backward
 * compatibility (existing users keep their capabilities), role→permission
 * mapping, missing-permission denial (403 AUTH_PERMISSION_DENIED), wildcard
 * grants, and super-admin bypass. Requires Postgres + Redis, migrations + seeds.
 */
describe('Permissions / PBAC (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct horse battery staple';
  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const api = () => request(app.getHttpServer());
  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
  };

  async function register(): Promise<TestUser> {
    await app.get(RedisService).getClient('rateLimit').flushdb();
    const username = `pb${randomBytes(5).toString('hex')}`;
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

  /** Grants a role in the DB, then returns a freshly-minted token carrying it. */
  async function elevate(user: TestUser, role: Role): Promise<string> {
    await app.get(RolesService).grantRole(user.id, role, null);
    return login(user.email);
  }

  const systemNotif = { title: 'Notice', body: 'Hello everyone' };

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    await app.get(RolesService).seedRoles();
    await app.get(PermissionsService).seed(); // idempotent; boot also seeds
  });

  afterEach(async () => {
    await app.get(RedisService).getClient('rateLimit').flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('backward compatibility (role → permissions)', () => {
    it('a normal user keeps their content capabilities (piece.create/publish)', async () => {
      const user = await register();
      const draft = await api()
        .post('/api/v1/pieces')
        .set(...bearer(user.token))
        .send({ title: 'Mine', content: doc, languageCode: 'ur', genreSlug: 'ghazal' })
        .expect(201);
      await api()
        .post(`/api/v1/pieces/${draft.body.data.id}/publish`)
        .set(...bearer(user.token))
        .expect(200);
    });
  });

  describe('missing permission', () => {
    it('denies a normal user an admin-only endpoint with 403 AUTH_PERMISSION_DENIED', async () => {
      const user = await register();
      await api()
        .post('/api/v1/admin/system-notifications')
        .set(...bearer(user.token))
        .send(systemNotif)
        .expect(403)
        .expect((r) => {
          expect(r.body.error.code).toBe('AUTH_PERMISSION_DENIED');
          expect(r.body.error.details).toContain('notification.manage');
        });
    });

    it('still requires authentication (401) before permission checks', async () => {
      await api().post('/api/v1/admin/system-notifications').send(systemNotif).expect(401);
    });
  });

  describe('role permission mapping + wildcards', () => {
    it('grants an admin the admin-only endpoint (via notification.manage)', async () => {
      const admin = await register();
      const token = await elevate(admin, Role.Admin);
      await api()
        .post('/api/v1/admin/system-notifications')
        .set(...bearer(token))
        .send(systemNotif)
        .expect(201);
    });

    it('lets an admin use a piece endpoint via the `piece.*` wildcard grant', async () => {
      const admin = await register();
      const token = await elevate(admin, Role.Admin);
      await api()
        .post('/api/v1/pieces')
        .set(...bearer(token))
        .send({ title: 'Admin piece', content: doc, languageCode: 'ur', genreSlug: 'ghazal' })
        .expect(201);
    });
  });

  describe('super-admin bypass', () => {
    it('lets a super-admin reach any permission via the `*` wildcard', async () => {
      const su = await register();
      const token = await elevate(su, Role.SuperAdmin);
      await api()
        .post('/api/v1/admin/system-notifications')
        .set(...bearer(token))
        .send(systemNotif)
        .expect(201);
    });
  });
});
