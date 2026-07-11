import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

import { FeatureFlag } from './entities/feature-flag.entity';
import { Setting } from './entities/setting.entity';
import { FeatureFlagsController } from './feature-flags.controller';
import { MaintenanceController } from './maintenance.controller';
import { SettingsCacheService } from './settings-cache.service';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

/**
 * System Settings (E12.8) — the generic configuration engine: a key-value store,
 * feature flags, and maintenance mode. Owns two additive tables (`settings`,
 * `feature_flags`) and reuses the shared audit trail (`AuditModule`) plus Redis
 * cache (global `RedisModule`). Auth guards + PBAC are global. `SettingsService`
 * is exported so other modules can read effective config (typed access over the
 * generic store) without touching the tables.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Setting, FeatureFlag]), AuditModule, AuthModule],
  controllers: [SettingsController, FeatureFlagsController, MaintenanceController],
  providers: [SettingsRepository, SettingsService, SettingsCacheService],
  exports: [SettingsService],
})
export class SettingsModule {}
