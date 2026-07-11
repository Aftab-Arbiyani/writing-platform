import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PiecesModule } from '../pieces/pieces.module';
import { UsersModule } from '../users/users.module';
import { AdminUsersController } from './admin-users.controller';

/**
 * Admin API surface (Epic E12.5) — controllers ONLY. It owns no business logic
 * and no providers: every endpoint orchestrates the exported services of the
 * modules it imports (`UsersService`, `ProfileService`, `RolesService`,
 * `PiecesService`, `AuthService`, `AnalyticsService`) plus the shared
 * `AuditService`. Guards (`JwtAuthGuard`, `RateLimitGuard`) and PBAC
 * (`PermissionGuard` via `@Permissions`) are global, so nothing else is wired.
 */
@Module({
  imports: [UsersModule, AuthModule, AnalyticsModule, PiecesModule, AuditModule],
  controllers: [AdminUsersController],
})
export class AdminModule {}
