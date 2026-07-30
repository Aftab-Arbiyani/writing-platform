import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { UsersService } from '../src/modules/users/users.service';
import { VerificationService } from '../src/modules/auth/services/verification.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Auth flow e2e (docs 05 §11, docs 13 §3). Requires live Postgres + Redis
 * (`docker compose up -d`) + a run migration. Uses `X-Client: mobile` for token
 * flows so refresh tokens arrive in the body (simpler than parsing cookies), and
 * grey-boxes verification tokens via the container (they're emailed, not
 * returned). Rate-limit + auth Redis DBs are flushed per test for isolation.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const mobile = { 'X-Client': 'mobile' } as const;
  const strongPassword = 'correct horse battery staple';

  const freshCreds = (): { email: string; username: string; password: string } => {
    const id = randomBytes(6).toString('hex');
    return { email: `u${id}@example.com`, username: `u${id}`, password: strongPassword };
  };

  const registerMobile = (creds = freshCreds()): request.Test =>
    request(app.getHttpServer()).post('/api/v1/auth/register').set(mobile).send(creds);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    const redis = app.get(RedisService);
    await redis.getClient('rateLimit').flushdb();
    await redis.getClient('auth').flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new account and returns a token pair', async () => {
    const creds = freshCreds();
    const res = await registerMobile(creds).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: creds.email,
      username: creds.username,
      isEmailVerified: false,
    });
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('sets an httpOnly refresh cookie for web clients', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(freshCreds())
      .expect(201);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('qalam_rt=') && c.includes('HttpOnly'))).toBe(true);
    expect(res.body.data.refreshToken).toBeUndefined(); // not in body for web
  });

  it('rejects a duplicate email with AUTH_EMAIL_TAKEN (409)', async () => {
    const creds = freshCreds();
    await registerMobile(creds).expect(201);
    const res = await registerMobile({ ...creds, username: `${creds.username}x` }).expect(409);
    expect(res.body.error.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('rejects a too-short password with VALIDATION_FAILED (400)', async () => {
    const res = await registerMobile({ ...freshCreds(), password: 'short' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a common password with AUTH_PASSWORD_WEAK (422)', async () => {
    const res = await registerMobile({ ...freshCreds(), password: 'password123' }).expect(422);
    expect(res.body.error.code).toBe('AUTH_PASSWORD_WEAK');
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const creds = freshCreds();
    await registerMobile(creds).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(mobile)
      .send({ email: creds.email, password: 'the-wrong-password' })
      .expect(401)
      .expect((res) => expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS'));

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(mobile)
      .send({ email: creds.email, password: creds.password })
      .expect(200)
      .expect((res) => expect(typeof res.body.data.accessToken).toBe('string'));
  });

  it('rejects a protected route without a token (401)', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
  });

  it('rotates a refresh token and detects reuse of the old one', async () => {
    const reg = await registerMobile().expect(201);
    const originalRefresh: string = reg.body.data.refreshToken;

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(mobile)
      .send({ refreshToken: originalRefresh })
      .expect(200);
    expect(rotated.body.data.refreshToken).not.toBe(originalRefresh);

    // Replaying the consumed token = reuse → family revoked.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(mobile)
      .send({ refreshToken: originalRefresh })
      .expect(401)
      .expect((res) => expect(res.body.error.code).toBe('AUTH_REFRESH_REUSED'));

    // The rotated (newer) token is now dead too (whole family revoked).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(mobile)
      .send({ refreshToken: rotated.body.data.refreshToken })
      .expect(401);
  });

  it('verifies an email with a valid token', async () => {
    const creds = freshCreds();
    const reg = await registerMobile(creds).expect(201);
    const userId: string = reg.body.data.user.id;

    // Grey-box: mint a fresh raw token (the emailed one isn't returned).
    const rawToken = await app.get(VerificationService).issue(userId);

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: rawToken })
      .expect(200);

    const user = await app.get(UsersService).findById(userId);
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('always returns 202 for forgot-password (no enumeration)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-here@example.com' })
      .expect(202);
  });

  it('changes password (with current) and issues fresh tokens', async () => {
    const creds = freshCreds();
    const reg = await registerMobile(creds).expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set({ ...mobile, Authorization: `Bearer ${reg.body.data.accessToken}` })
      .send({ currentPassword: creds.password, newPassword: 'a-brand-new-strong-passphrase' })
      .expect(200);
    expect(typeof res.body.data.accessToken).toBe('string');

    // The new password now logs in.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(mobile)
      .send({ email: creds.email, password: 'a-brand-new-strong-passphrase' })
      .expect(200);
  });
});
