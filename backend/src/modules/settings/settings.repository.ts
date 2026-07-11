import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

import type { FeatureFlagDefinition, SettingDefinition } from './settings.catalog';
import { FeatureFlag } from './entities/feature-flag.entity';
import { Setting } from './entities/setting.entity';

/** A new feature-flag row (id/timestamps assigned here / by the entity). */
export interface NewFeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  environment: string;
  description: string;
  updatedBy: string | null;
}

/** Mutable feature-flag fields for a partial update. */
export interface FeatureFlagPatch {
  enabled?: boolean;
  rolloutPercentage?: number;
  environment?: string;
  description?: string;
  updatedBy: string | null;
}

/**
 * Data access for `settings` + `feature_flags` (E12.8). The only place these two
 * tables are queried (docs 16 §3.3 — repositories own the query builders). A
 * single repository serves both because the module is one cohesive aggregate
 * (configuration), matching the "SettingsRepository" contract.
 */
@Injectable()
export class SettingsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private settings(manager?: EntityManager): Repository<Setting> {
    return (manager ?? this.dataSource.manager).getRepository(Setting);
  }

  private flags(manager?: EntityManager): Repository<FeatureFlag> {
    return (manager ?? this.dataSource.manager).getRepository(FeatureFlag);
  }

  // ── Settings ──────────────────────────────────────────────────────────────────

  /** All settings, ordered by category then key (the admin grid order). */
  findAll(): Promise<Setting[]> {
    return this.settings()
      .createQueryBuilder('s')
      .orderBy('s.category', 'ASC')
      .addOrderBy('s.key', 'ASC')
      .getMany();
  }

  /** Settings in one category, ordered by key. */
  findByCategory(category: string): Promise<Setting[]> {
    return this.settings()
      .createQueryBuilder('s')
      .where('s.category = :category', { category })
      .orderBy('s.key', 'ASC')
      .getMany();
  }

  /** The specific settings for a set of keys. */
  findByKeys(keys: string[]): Promise<Setting[]> {
    if (keys.length === 0) {
      return Promise.resolve([]);
    }
    return this.settings().createQueryBuilder('s').where('s.key IN (:...keys)', { keys }).getMany();
  }

  findByKey(key: string): Promise<Setting | null> {
    return this.settings().findOne({ where: { key } });
  }

  /** Updates a setting's value + author (row is guaranteed by {@link syncDefinitions}). */
  async setValue(
    key: string,
    value: unknown,
    updatedBy: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    // `value` is a polymorphic jsonb payload; cast satisfies TypeORM's write type
    // (the column serialises any JSON value regardless of the static type).
    await this.settings(manager).update({ key }, { value: value as object, updatedBy });
  }

  /**
   * Idempotently seeds every catalogue definition as a row: inserts keys that are
   * missing and leaves existing rows (admin-set `value`/`updated_by`, and their
   * `updated_at`) untouched. This is how a new setting appears without a schema
   * migration — add it to the catalogue and the next boot inserts it.
   */
  async syncDefinitions(definitions: readonly SettingDefinition[]): Promise<void> {
    if (definitions.length === 0) {
      return;
    }
    const rows = definitions.map((definition) => ({
      id: uuidv7(),
      key: definition.key,
      category: definition.category,
      value: definition.defaultValue as object,
      dataType: definition.dataType,
      defaultValue: definition.defaultValue as object,
      validationRules: definition.validationRules as object,
      description: definition.description,
      editable: definition.editable,
      environmentScope: definition.environmentScope,
      updatedBy: null,
    }));
    await this.settings()
      .createQueryBuilder()
      .insert()
      .into(Setting)
      .values(rows)
      .orIgnore()
      .execute();
  }

  // ── Feature flags ─────────────────────────────────────────────────────────────

  findAllFlags(): Promise<FeatureFlag[]> {
    return this.flags().createQueryBuilder('f').orderBy('f.key', 'ASC').getMany();
  }

  findFlagById(id: string): Promise<FeatureFlag | null> {
    return this.flags().findOne({ where: { id } });
  }

  findFlagByKey(key: string): Promise<FeatureFlag | null> {
    return this.flags().findOne({ where: { key } });
  }

  async createFlag(input: NewFeatureFlag): Promise<FeatureFlag> {
    const repo = this.flags();
    return repo.save(repo.create(input));
  }

  async updateFlag(id: string, patch: FeatureFlagPatch): Promise<void> {
    await this.flags().update({ id }, patch);
  }

  async deleteFlag(id: string): Promise<void> {
    await this.flags().delete({ id });
  }

  /** Seeds the catalogued feature flags; existing keys are left untouched. */
  async syncFlagDefinitions(definitions: readonly FeatureFlagDefinition[]): Promise<void> {
    if (definitions.length === 0) {
      return;
    }
    const rows = definitions.map((definition) => ({
      id: uuidv7(),
      key: definition.key,
      enabled: definition.enabled,
      rolloutPercentage: definition.rolloutPercentage,
      environment: definition.environment,
      description: definition.description,
      updatedBy: null,
    }));
    await this.flags()
      .createQueryBuilder()
      .insert()
      .into(FeatureFlag)
      .values(rows)
      .orIgnore()
      .execute();
  }
}
