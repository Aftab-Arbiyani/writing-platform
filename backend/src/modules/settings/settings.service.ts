import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import {
  FEATURE_FLAG_DEFINITIONS,
  SETTING_DEFINITIONS,
  SETTING_DEFINITION_BY_KEY,
} from './settings.catalog';
import {
  MAINTENANCE_KEYS,
  SETTINGS_AUDIT_ACTIONS,
  SETTINGS_AUDIT_TARGET,
  SETTINGS_CACHE_KEYS,
  SETTINGS_CACHE_TTL_SECONDS,
} from './settings.constants';
import {
  FeatureFlagAlreadyExistsException,
  FeatureFlagNotFoundException,
  SettingNotEditableException,
  SettingNotFoundException,
} from './settings.exceptions';
import { SettingsCacheService } from './settings-cache.service';
import { SettingsRepository } from './settings.repository';
import { validateSettingValue } from './settings.validation';
import type { SettingsActor } from './settings.util';
import type { FeatureFlag } from './entities/feature-flag.entity';
import type { Setting } from './entities/setting.entity';
import type { SettingDto } from './dto/setting-response.dto';
import type {
  FeatureFlagDto,
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
} from './dto/feature-flag.dto';
import type { MaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';
import type { UpdateSettingItemDto } from './dto/update-settings.dto';

/** One applied change, captured for the audit trail. */
interface SettingChange {
  id: string;
  key: string;
  before: unknown;
  after: unknown;
}

/**
 * System Settings service (E12.8) — the generic configuration engine. Owns the
 * settings + feature-flags tables and orchestrates the shared `AuditService`
 * (every mutation is audited) and `SettingsCacheService` (hot reads are cached
 * and invalidated on write). Business rules only; the catalogue defines defaults
 * and validation, DTOs check request shape.
 *
 * Exported so future modules can read effective config via {@link getValue}
 * without re-implementing the store (typed access over generic KV storage).
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly repository: SettingsRepository,
    private readonly cache: SettingsCacheService,
    private readonly audit: AuditService,
  ) {}

  /** Seeds the catalogue (idempotent) so the tables reflect every known setting/flag. */
  async onModuleInit(): Promise<void> {
    await this.repository.syncDefinitions(SETTING_DEFINITIONS);
    await this.repository.syncFlagDefinitions(FEATURE_FLAG_DEFINITIONS);
  }

  // ── Settings reads ────────────────────────────────────────────────────────────

  /** Every setting (cached), ordered by category then key. */
  getAllSettings(): Promise<SettingDto[]> {
    return this.cache.remember(SETTINGS_CACHE_KEYS.All, SETTINGS_CACHE_TTL_SECONDS, async () => {
      const rows = await this.repository.findAll();
      return rows.map(toSettingDto);
    });
  }

  /** Settings in one category (derived from the cached full set). */
  async getSettingsByCategory(category: string): Promise<SettingDto[]> {
    const all = await this.getAllSettings();
    return all.filter((setting) => setting.category === category);
  }

  /** The effective value of one key — typed access for other modules. */
  async getValue(key: string): Promise<unknown> {
    const all = await this.getAllSettings();
    const setting = all.find((entry) => entry.key === key);
    if (setting === undefined) {
      throw new SettingNotFoundException(key);
    }
    return setting.value;
  }

  // ── Settings writes ───────────────────────────────────────────────────────────

  /** Batch-update settings across any category. */
  async updateSettings(
    items: UpdateSettingItemDto[],
    actor: SettingsActor,
    reason?: string,
  ): Promise<SettingDto[]> {
    return this.applyAndAudit(items, actor, reason, undefined);
  }

  /** Batch-update settings, rejecting any key that is not in `category`. */
  async updateSettingsByCategory(
    category: string,
    items: UpdateSettingItemDto[],
    actor: SettingsActor,
    reason?: string,
  ): Promise<SettingDto[]> {
    return this.applyAndAudit(items, actor, reason, category);
  }

  /**
   * Validates every item, writes them atomically, invalidates the cache, and
   * records one `setting.update` audit entry per changed key (before/after).
   */
  private async applyAndAudit(
    items: UpdateSettingItemDto[],
    actor: SettingsActor,
    reason: string | undefined,
    categoryScope: string | undefined,
  ): Promise<SettingDto[]> {
    const changes = await this.applyUpdates(items, actor, categoryScope);
    await this.cache.invalidate(SETTINGS_CACHE_KEYS.All, SETTINGS_CACHE_KEYS.Maintenance);
    for (const change of changes) {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action: SETTINGS_AUDIT_ACTIONS.SettingUpdate,
        targetId: change.id,
        targetType: SETTINGS_AUDIT_TARGET.Setting,
        metadata: { key: change.key, before: change.before, after: change.after, reason },
        context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
      });
    }
    const rows = await this.repository.findByKeys(changes.map((change) => change.key));
    return rows.map(toSettingDto);
  }

  /**
   * Validates each item against the catalogue (existence, editability, value
   * type/rules) then writes all values in a single transaction. Validation is
   * fully done BEFORE any write, so an invalid item aborts the whole batch.
   */
  private async applyUpdates(
    items: UpdateSettingItemDto[],
    actor: SettingsActor,
    categoryScope: string | undefined,
  ): Promise<SettingChange[]> {
    const current = await this.repository.findByKeys(items.map((item) => item.key));
    const byKey = new Map(current.map((row) => [row.key, row]));

    // Validate everything first (fail fast, no partial write).
    for (const item of items) {
      const definition = SETTING_DEFINITION_BY_KEY.get(item.key);
      if (
        definition === undefined ||
        (categoryScope !== undefined && definition.category !== categoryScope)
      ) {
        throw new SettingNotFoundException(item.key);
      }
      if (!definition.editable) {
        throw new SettingNotEditableException(item.key);
      }
      validateSettingValue(item.key, definition.dataType, item.value, definition.validationRules);
    }

    const changes: SettingChange[] = [];
    await this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        const row = byKey.get(item.key);
        await this.repository.setValue(item.key, item.value, actor.id, manager);
        changes.push({
          id: row?.id ?? item.key,
          key: item.key,
          before: row?.value ?? null,
          after: item.value,
        });
      }
    });
    return changes;
  }

  // ── Feature flags ─────────────────────────────────────────────────────────────

  getFeatureFlags(): Promise<FeatureFlagDto[]> {
    return this.cache.remember(SETTINGS_CACHE_KEYS.Flags, SETTINGS_CACHE_TTL_SECONDS, async () => {
      const flags = await this.repository.findAllFlags();
      return flags.map(toFeatureFlagDto);
    });
  }

  async createFeatureFlag(
    dto: CreateFeatureFlagDto,
    actor: SettingsActor,
  ): Promise<FeatureFlagDto> {
    const existing = await this.repository.findFlagByKey(dto.key);
    if (existing !== null) {
      throw new FeatureFlagAlreadyExistsException(dto.key);
    }
    const flag = await this.repository.createFlag({
      key: dto.key,
      enabled: dto.enabled ?? false,
      rolloutPercentage: dto.rolloutPercentage ?? 0,
      environment: dto.environment ?? 'all',
      description: dto.description ?? '',
      updatedBy: actor.id,
    });
    await this.cache.invalidate(SETTINGS_CACHE_KEYS.Flags);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: SETTINGS_AUDIT_ACTIONS.FeatureFlagCreate,
      targetId: flag.id,
      targetType: SETTINGS_AUDIT_TARGET.FeatureFlag,
      metadata: { key: flag.key, after: toFeatureFlagDto(flag) },
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
    return toFeatureFlagDto(flag);
  }

  async updateFeatureFlag(
    id: string,
    dto: UpdateFeatureFlagDto,
    actor: SettingsActor,
  ): Promise<FeatureFlagDto> {
    const before = await this.repository.findFlagById(id);
    if (before === null) {
      throw new FeatureFlagNotFoundException();
    }
    await this.repository.updateFlag(id, {
      enabled: dto.enabled,
      rolloutPercentage: dto.rolloutPercentage,
      environment: dto.environment,
      description: dto.description,
      updatedBy: actor.id,
    });
    const after = await this.repository.findFlagById(id);
    await this.cache.invalidate(SETTINGS_CACHE_KEYS.Flags);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: SETTINGS_AUDIT_ACTIONS.FeatureFlagUpdate,
      targetId: id,
      targetType: SETTINGS_AUDIT_TARGET.FeatureFlag,
      metadata: {
        key: before.key,
        before: toFeatureFlagDto(before),
        after: after === null ? null : toFeatureFlagDto(after),
      },
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
    // `after` is non-null: the row existed a statement ago and update never deletes.
    return toFeatureFlagDto(after ?? before);
  }

  async deleteFeatureFlag(id: string, actor: SettingsActor): Promise<void> {
    const before = await this.repository.findFlagById(id);
    if (before === null) {
      throw new FeatureFlagNotFoundException();
    }
    await this.repository.deleteFlag(id);
    await this.cache.invalidate(SETTINGS_CACHE_KEYS.Flags);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: SETTINGS_AUDIT_ACTIONS.FeatureFlagDelete,
      targetId: id,
      targetType: SETTINGS_AUDIT_TARGET.FeatureFlag,
      metadata: { key: before.key, before: toFeatureFlagDto(before) },
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
  }

  // ── Maintenance mode ──────────────────────────────────────────────────────────

  /** The maintenance-mode view, derived from the `maintenance.*` settings. */
  async getMaintenance(): Promise<MaintenanceDto> {
    const all = await this.getAllSettings();
    const value = (key: string): unknown => all.find((setting) => setting.key === key)?.value;
    const completion = value(MAINTENANCE_KEYS.EstimatedCompletion);
    const roles = value(MAINTENANCE_KEYS.AllowedRoles);
    return {
      enabled: value(MAINTENANCE_KEYS.Enabled) === true,
      message:
        typeof value(MAINTENANCE_KEYS.Message) === 'string'
          ? (value(MAINTENANCE_KEYS.Message) as string)
          : '',
      estimatedCompletion: typeof completion === 'string' && completion !== '' ? completion : null,
      allowedRoles: Array.isArray(roles) ? (roles as string[]) : [],
    };
  }

  /** Updates maintenance mode (only the provided fields) with one audit entry. */
  async updateMaintenance(
    dto: UpdateMaintenanceDto,
    actor: SettingsActor,
  ): Promise<MaintenanceDto> {
    const before = await this.getMaintenance();
    const items: UpdateSettingItemDto[] = [];
    if (dto.enabled !== undefined) {
      items.push({ key: MAINTENANCE_KEYS.Enabled, value: dto.enabled });
    }
    if (dto.message !== undefined) {
      items.push({ key: MAINTENANCE_KEYS.Message, value: dto.message });
    }
    if (dto.estimatedCompletion !== undefined) {
      items.push({ key: MAINTENANCE_KEYS.EstimatedCompletion, value: dto.estimatedCompletion });
    }
    if (dto.allowedRoles !== undefined) {
      items.push({ key: MAINTENANCE_KEYS.AllowedRoles, value: dto.allowedRoles });
    }

    if (items.length > 0) {
      await this.applyUpdates(items, actor, 'maintenance');
      await this.cache.invalidate(SETTINGS_CACHE_KEYS.All, SETTINGS_CACHE_KEYS.Maintenance);
    }
    const after = await this.getMaintenance();
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: SETTINGS_AUDIT_ACTIONS.MaintenanceUpdate,
      targetId: null,
      targetType: SETTINGS_AUDIT_TARGET.Maintenance,
      metadata: { before, after, reason: dto.reason },
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
    return after;
  }
}

/** Maps a persisted setting row to its wire DTO (never returns the entity raw). */
function toSettingDto(row: Setting): SettingDto {
  return {
    key: row.key,
    category: row.category,
    value: row.value,
    dataType: row.dataType,
    defaultValue: row.defaultValue,
    validationRules: row.validationRules,
    description: row.description,
    editable: row.editable,
    environmentScope: row.environmentScope,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedBy === null ? null : row.updatedAt.toISOString(),
  };
}

/** Maps a feature-flag row to its wire DTO. */
function toFeatureFlagDto(flag: FeatureFlag): FeatureFlagDto {
  return {
    id: flag.id,
    key: flag.key,
    enabled: flag.enabled,
    rolloutPercentage: flag.rolloutPercentage,
    environment: flag.environment,
    description: flag.description,
    updatedBy: flag.updatedBy,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}
