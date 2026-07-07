import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './utils/create-test-app';

/**
 * Foundation smoke test (not a feature test). Proves the e2e harness boots the
 * real app against live infra and that the health probes answer. Requires
 * `docker compose up -d` (Postgres + Redis). Run with `pnpm test:e2e`.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports the process alive', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    // Wrapped in the ADR §5 success envelope by the TransformInterceptor.
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('GET /health/ready reports dependencies up', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.details).toHaveProperty('database');
    expect(response.body.data.details).toHaveProperty('redis');
  });

  it('unknown routes return the ADR §5 error envelope', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error).toHaveProperty('requestId');
  });
});
