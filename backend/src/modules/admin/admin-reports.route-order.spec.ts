import { Module, type CanActivate, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { PermissionGuard } from '../permissions/permission.guard';
import { ReportsAdminController } from '../moderation/reports.admin.controller';
import { AdminReportsController } from './admin-reports.controller';

/**
 * Route-precedence guard (E12.7). The static admin report routes
 * (`/admin/reports/statistics|trends|export`) share the `admin/reports` prefix
 * with the moderation controller's `GET :id`. This test reproduces the exact
 * production module nesting (AdminModule → imports ModerationModule) with mocked
 * services and proves `/statistics` resolves to the statistics handler — not to
 * `:id` (which would 400 via ParseUUIDPipe).
 */
const moderationMock = {
  getStatistics: jest.fn().mockResolvedValue({ openReports: 5, resolvedReports: 2 }),
  getReport: jest.fn(),
};
const auditMock = {};

@Module({
  controllers: [ReportsAdminController],
  providers: [{ provide: ModerationService, useValue: moderationMock }],
})
class MockModerationModule {}

@Module({
  imports: [MockModerationModule],
  controllers: [AdminReportsController],
  providers: [
    { provide: ModerationService, useValue: moderationMock },
    { provide: AuditService, useValue: auditMock },
  ],
})
class MockAdminModule {}

describe('Admin report route precedence', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const allow: CanActivate = { canActivate: () => true };
    const moduleRef = await Test.createTestingModule({ imports: [MockAdminModule] })
      .overrideGuard(PermissionGuard)
      .useValue(allow)
      .overrideGuard(RateLimitGuard)
      .useValue(allow)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/reports/statistics hits the statistics handler, not :id', async () => {
    const res = await request(app.getHttpServer()).get('/admin/reports/statistics');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ openReports: 5 });
    expect(moderationMock.getReport).not.toHaveBeenCalled();
  });
});
