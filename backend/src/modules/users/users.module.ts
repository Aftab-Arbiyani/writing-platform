import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AccountStatusService } from './account-status.service';
import { Follow } from './entities/follow.entity';
import { Profile } from './entities/profile.entity';
import { ProfileGenre } from './entities/profile-genre.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UserSettings } from './entities/user-settings.entity';
import { FollowRepository } from './follow.repository';
import { FollowService } from './follow.service';
import { FollowsController } from './follows.controller';
import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { ProfilesController } from './profiles.controller';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UserSettingsRepository } from './user-settings.repository';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Accounts + RBAC (E1) and the profile/follow/settings domain (E3). Depends on
 * `TaxonomyModule` (language/genre validation) and the global `MediaModule`
 * (avatar/cover). Exports the services other modules integrate through (docs 16
 * §3.1) — never the repositories. Guards/decorators are file-imported from the
 * auth module (no AuthModule import → no circular dependency).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserRole, Profile, UserSettings, Follow, ProfileGenre]),
    TaxonomyModule,
  ],
  controllers: [ProfilesController, FollowsController, SettingsController],
  providers: [
    UsersRepository,
    UsersService,
    RolesRepository,
    RolesService,
    ProfileRepository,
    ProfileService,
    FollowRepository,
    FollowService,
    UserSettingsRepository,
    SettingsService,
    /**
     * B9 (A2-1): self-registers the account-status port with the `@Global`
     * `PolicyEngineService` at bootstrap, so the engine stops treating a suspended
     * account as being in good standing. Injected, never imported — the same
     * no-cycle arrangement `TrustStatusService` uses from the other side.
     */
    AccountStatusService,
  ],
  /**
   * `SettingsService` is exported for B5 (docs/45 §4.10): the AI gate
   * (`AiFeatureService`) reads the caller's own "turn AI off" preference through it.
   * The service, never `UserSettingsRepository` — other modules integrate through
   * services only (docs 16 §3.1).
   */
  exports: [UsersService, RolesService, ProfileService, FollowService, SettingsService],
})
export class UsersModule {}
