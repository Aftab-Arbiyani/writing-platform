import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { RedisService } from '../src/redis/redis.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Writing lifecycle e2e (docs 18 E3/E4). Requires Postgres + Redis + MinIO,
 * migrations run, and taxonomy seeded (`pnpm seed` — needs language `ur` +
 * genre `ghazal`). `X-Client: mobile` yields body tokens.
 */
describe('Pieces (e2e)', () => {
  let app: INestApplication;
  let author: { id: string; token: string };
  let other: { id: string; token: string };
  let draftId: string;
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Barish ki raat mein likha gaya nazm.' }],
      },
    ],
  };
  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];

  async function register(): Promise<{ id: string; token: string }> {
    const username = `w${randomBytes(5).toString('hex')}`;
    const res = await request(app.getHttpServer())
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

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(RedisService).getClient('rateLimit').flushdb();
    author = await register();
    other = await register();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a draft with derived word count + reading time', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pieces')
      .set(...bearer(author.token))
      .send({
        title: 'Raat ki baarish',
        content: doc,
        languageCode: 'ur',
        genreSlug: 'ghazal',
        tags: ['barish', 'raat'],
      })
      .expect(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.slug).toBeNull();
    expect(res.body.data.wordCount).toBeGreaterThan(0);
    expect(res.body.data.readingTimeSeconds).toBeGreaterThan(0);
    expect(res.body.data.tags.map((t: { slug: string }) => t.slug).sort()).toEqual([
      'barish',
      'raat',
    ]);
    expect(res.body.data.language.direction).toBe('rtl');
    draftId = res.body.data.id;
  });

  it('rejects content that fails the schema whitelist (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pieces')
      .set(...bearer(author.token))
      .send({ content: { type: 'doc', content: [{ type: 'iframe' }] }, languageCode: 'ur' })
      .expect(422);
    expect(res.body.error.code).toBe('PIECE_CONTENT_INVALID');
  });

  it('a draft is invisible to a non-owner (404)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/pieces/${draftId}`)
      .set(...bearer(other.token))
      .expect(404);
  });

  it('a non-owner cannot edit (404, privacy-preserving)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/pieces/${draftId}`)
      .set(...bearer(other.token))
      .send({ title: 'hijack' })
      .expect(404);
  });

  it('updates the draft and recomputes metrics', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/pieces/${draftId}`)
      .set(...bearer(author.token))
      .send({
        subtitle: 'ek nazm',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'chhoti si baat' }] }],
        },
      })
      .expect(200);
    expect(res.body.data.subtitle).toBe('ek nazm');
    expect(res.body.data.wordCount).toBe(3);
  });

  it('publishes: generates a slug and makes it publicly readable', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/pieces/${draftId}/publish`)
      .set(...bearer(author.token))
      .expect(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.slug).toMatch(/^raat-ki-baarish/);
    expect(res.body.data.publishedAt).not.toBeNull();
    // Now visible to a stranger (public piece, public author).
    const view = await request(app.getHttpServer()).get(`/api/v1/pieces/${draftId}`).expect(200);
    expect(view.body.data.status).toBe('published');
  });

  it('does not change the slug when the title changes after publish', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/pieces/${draftId}`)
      .set(...bearer(author.token))
      .send({ title: 'A completely different title' })
      .expect(200);
    expect(res.body.data.slug).toMatch(/^raat-ki-baarish/); // immutable
  });

  it('rejects re-publishing (409)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/pieces/${draftId}/publish`)
      .set(...bearer(author.token))
      .expect(409)
      .expect((r) => expect(r.body.error.code).toBe('PIECE_ALREADY_PUBLISHED'));
  });

  it('archives then unarchives', async () => {
    const archived = await request(app.getHttpServer())
      .post(`/api/v1/pieces/${draftId}/archive`)
      .set(...bearer(author.token))
      .expect(200);
    expect(archived.body.data.status).toBe('archived');
    // Archived piece invisible to strangers.
    await request(app.getHttpServer()).get(`/api/v1/pieces/${draftId}`).expect(404);
    const restored = await request(app.getHttpServer())
      .post(`/api/v1/pieces/${draftId}/unarchive`)
      .set(...bearer(author.token))
      .expect(200);
    expect(restored.body.data.status).toBe('published');
  });

  it('rejects scheduling in the past and accepts a future date', async () => {
    const fresh = await request(app.getHttpServer())
      .post('/api/v1/pieces')
      .set(...bearer(author.token))
      .send({ title: 'Scheduled nazm', content: doc, languageCode: 'ur', genreSlug: 'ghazal' })
      .expect(201);
    const id = fresh.body.data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/pieces/${id}/schedule`)
      .set(...bearer(author.token))
      .send({ scheduledAt: '2000-01-01T00:00:00.000Z' })
      .expect(422)
      .expect((r) => expect(r.body.error.code).toBe('PIECE_SCHEDULE_IN_PAST'));
    const ok = await request(app.getHttpServer())
      .post(`/api/v1/pieces/${id}/schedule`)
      .set(...bearer(author.token))
      .send({ scheduledAt: '2099-01-01T00:00:00.000Z' })
      .expect(200);
    expect(ok.body.data.status).toBe('scheduled');
    expect(ok.body.data.scheduledAt).not.toBeNull();
  });

  it('rejects publishing an incomplete draft (missing genre)', async () => {
    const fresh = await request(app.getHttpServer())
      .post('/api/v1/pieces')
      .set(...bearer(author.token))
      .send({ title: 'No genre', content: doc, languageCode: 'ur' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/pieces/${fresh.body.data.id}/publish`)
      .set(...bearer(author.token))
      .expect(422)
      .expect((r) => expect(r.body.error.code).toBe('PIECE_INCOMPLETE'));
  });

  it('duplicates a piece into a fresh draft', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/pieces/${draftId}/duplicate`)
      .set(...bearer(author.token))
      .expect(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.slug).toBeNull();
    expect(res.body.data.title).toContain('(copy)');
  });

  it('lists my drafts and pieces (cursor-paginated)', async () => {
    const drafts = await request(app.getHttpServer())
      .get('/api/v1/me/drafts')
      .set(...bearer(author.token))
      .expect(200);
    expect(Array.isArray(drafts.body.data)).toBe(true);
    expect(drafts.body.data.every((p: { status: string }) => p.status === 'draft')).toBe(true);
    expect(drafts.body.meta.pagination).toHaveProperty('hasMore');
    const all = await request(app.getHttpServer())
      .get('/api/v1/me/pieces')
      .set(...bearer(author.token))
      .expect(200);
    expect(all.body.data.length).toBeGreaterThan(0);
  });

  it('uploads a cover image', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 1200, height: 400, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/pieces/${draftId}/cover`)
      .set(...bearer(author.token))
      .attach('file', png, { filename: 'cover.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body.data.key).toMatch(/^pieces\/.*\/cover-.*\.webp$/);
  });
});
