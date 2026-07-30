import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AiModelAvailability } from '@qalam/shared';
import type { AiModelMetadata, AiProvider } from '@qalam/shared';
import { Repository } from 'typeorm';

import { AiModelNotFoundException, AiModelUnavailableException } from '../ai.exceptions';
import { AI_MODEL_CATALOG } from './model-catalog';
import { AiModel } from './entities/ai-model.entity';

/**
 * The model registry (AF1). Serves model metadata (capabilities, context window,
 * streaming/vision/json support, cost, availability, defaults) from an in-memory
 * map seeded by {@link AI_MODEL_CATALOG}. On boot it upserts the catalogue into
 * the `ai_models` table (preserving admin overrides) and re-hydrates the map from
 * the DB — but if the table isn't present yet (migration not run) it logs and
 * serves the catalogue directly, so the registry is always functional.
 *
 * This is the single source clients + the orchestrator consult to resolve a
 * model and assert it can do what a request needs — no provider-specific model
 * knowledge leaks elsewhere.
 */
@Injectable()
export class ModelRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ModelRegistryService.name);
  private readonly models = new Map<string, AiModelMetadata>();

  constructor(@InjectRepository(AiModel) private readonly repo: Repository<AiModel>) {
    for (const model of AI_MODEL_CATALOG) {
      this.models.set(model.id, { ...model, capabilities: [...model.capabilities] });
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.syncCatalog();
      await this.hydrateFromDb();
    } catch (error) {
      this.logger.warn(
        `AI model registry serving in-memory catalogue (DB sync skipped): ${String(error)}`,
      );
    }
  }

  /** All registered models. */
  list(): AiModelMetadata[] {
    return [...this.models.values()];
  }

  /** Models for one provider. */
  listByProvider(provider: AiProvider): AiModelMetadata[] {
    return this.list().filter((model) => model.provider === provider);
  }

  /** A model by id, or throws `AI_MODEL_NOT_FOUND`. */
  getModel(modelId: string): AiModelMetadata {
    const model = this.models.get(modelId);
    if (model === undefined) {
      throw new AiModelNotFoundException(modelId);
    }
    return model;
  }

  /** The default model for a provider (its `isDefault`, else its first). */
  defaultModelFor(provider: AiProvider): AiModelMetadata {
    const forProvider = this.listByProvider(provider);
    const preferred = forProvider.find((model) => model.isDefault) ?? forProvider[0];
    if (preferred === undefined) {
      throw new AiModelNotFoundException(`(default for ${provider})`);
    }
    return preferred;
  }

  /**
   * Resolve a usable model for a call: the named model if given (validated
   * against the provider + availability), otherwise the provider default.
   */
  resolveModel(provider: AiProvider, modelId?: string): AiModelMetadata {
    const model =
      modelId != null && modelId !== '' ? this.getModel(modelId) : this.defaultModelFor(provider);
    this.assertUsable(model);
    return model;
  }

  /** Throws if the model is disabled (deprecated/preview are still callable). */
  assertUsable(model: AiModelMetadata): void {
    if (model.availability === AiModelAvailability.Disabled) {
      throw new AiModelUnavailableException(model.id);
    }
  }

  // ── Persistence (admin-override seam; guarded so a missing table is harmless) ─

  private async syncCatalog(): Promise<void> {
    for (const model of AI_MODEL_CATALOG) {
      const existing = await this.repo.findOne({
        where: { provider: model.provider, modelId: model.id },
      });
      if (existing !== null) {
        continue; // preserve admin overrides — only insert models not yet persisted
      }
      await this.repo.save(
        this.repo.create({
          provider: model.provider,
          modelId: model.id,
          displayName: model.displayName,
          contextWindow: model.contextWindow,
          maxOutputTokens: model.maxOutputTokens,
          capabilities: model.capabilities,
          supportsStreaming: model.supportsStreaming,
          supportsVision: model.supportsVision,
          supportsJsonMode: model.supportsJsonMode,
          inputCostPerMillion: model.inputCostPerMillion,
          outputCostPerMillion: model.outputCostPerMillion,
          availability: model.availability,
          isDefault: model.isDefault,
          updatedBy: null,
        }),
      );
    }
  }

  private async hydrateFromDb(): Promise<void> {
    const rows = await this.repo.find();
    if (rows.length === 0) {
      return;
    }
    this.models.clear();
    for (const row of rows) {
      this.models.set(row.modelId, this.toMetadata(row));
    }
  }

  private toMetadata(row: AiModel): AiModelMetadata {
    return {
      id: row.modelId,
      provider: row.provider,
      displayName: row.displayName,
      contextWindow: row.contextWindow,
      maxOutputTokens: row.maxOutputTokens,
      capabilities: row.capabilities,
      supportsStreaming: row.supportsStreaming,
      supportsVision: row.supportsVision,
      supportsJsonMode: row.supportsJsonMode,
      inputCostPerMillion: row.inputCostPerMillion,
      outputCostPerMillion: row.outputCostPerMillion,
      availability: row.availability,
      isDefault: row.isDefault,
    };
  }
}
