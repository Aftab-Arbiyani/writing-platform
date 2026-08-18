import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications';
import { UsersModule } from '../users/users.module';

import { TrustProfile } from './entities/trust-profile.entity';
import { UserBlock } from './entities/user-block.entity';
import { UserRestriction } from './entities/user-restriction.entity';
import { UserStrike } from './entities/user-strike.entity';
import { TrustAdminController } from './trust.admin.controller';
import { TrustController } from './trust.controller';
import { TrustRepository } from './trust.repository';
import { TrustService } from './trust.service';
import { TrustStatusService } from './trust-status.service';

/**
 * Trust & Safety (AF6). Owns four tables (`forFeature`); records via the shared
 * `AuditModule`; delivers best-effort notifications via `NotificationsModule`.
 * `TrustStatusService` self-registers the Trust port with the (already `@Global`)
 * `PolicyEngineService` at bootstrap, so PolicyModule and PermissionsModule are
 * injected/decorator-used, never imported here (avoids cycles). Exports
 * `TrustService` (for other server modules) and `TrustStatusService` (the port).
 *
 * `UsersModule` (B9, A2-4) is imported for ONE read: whether an id passed to an admin
 * trust route belongs to a real account. `trust_profiles` has no FK to `users`, so
 * nothing else could answer it. The direction is safe — `UsersModule` imports only
 * `TaxonomyModule` and never reaches back here.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TrustProfile, UserStrike, UserRestriction, UserBlock]),
    AuditModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [TrustController, TrustAdminController],
  providers: [TrustRepository, TrustService, TrustStatusService],
  exports: [TrustService, TrustStatusService],
})
export class TrustModule {}
