import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AI_GENERATION_DEFAULTS, AI_PARAM_BOUNDS, clampAiParam } from '@qalam/shared';
import type { AiGenerationParams, AiProvider, AiResolvedConfig } from '@qalam/shared';
import { Repository } from 'typeorm';

import { aiConfig } from '../../../config/ai.config';
import { ModelRegistryService } from '../registry/model-registry.service';
import { AiConfigOverride } from './entities/ai-config-override.entity';
import { AiOrgConfig } from './entities/ai-org-config.entity';

/** Org-level defaults as returned to admins / used as the merge base. */
export interface AiOrgDefaults {
  provider: AiProvider;
  model: string;
  params: AiGenerationParams;
  streaming: boolean;
  safety: Record<string, unknown>;
}

/** A user's overrides (all optional). */
export interface AiUserOverrides {
  provider?: AiProvider;
  model?: string;
  params?: AiGenerationParams;
  streaming?: boolean;
}

/**
 * Resolves the EFFECTIVE AI configuration for a call by layering three sources
 * (AF1): env baseline (`aiConfig`) → org defaults row → the user's overrides.
 * Params are clamped to safe bounds and the model is validated against the
 * registry, so the orchestrator always receives a sane, provider-agnostic
 * {@link AiResolvedConfig}. This is the ONLY place config is merged — nothing
 * else decides provider/model/params.
 */
@Injectable()
export class AiConfigService {
  constructor(
    @Inject(aiConfig.KEY) private readonly env: ConfigType<typeof aiConfig>,
    @InjectRepository(AiOrgConfig) private readonly orgRepo: Repository<AiOrgConfig>,
    @InjectRepository(AiConfigOverride)
    private readonly overrideRepo: Repository<AiConfigOverride>,
    private readonly registry: ModelRegistryService,
  ) {}

  /** The org defaults (admin row if present, else the env baseline). */
  async getOrgDefaults(): Promise<AiOrgDefaults> {
    const row = await this.orgRepo.find({ take: 1 });
    const org = row[0];
    if (org === undefined) {
      return {
        provider: this.env.defaultProvider,
        model: this.env.defaultModel,
        params: { ...AI_GENERATION_DEFAULTS },
        streaming: true,
        safety: {},
      };
    }
    return {
      provider: org.provider,
      model: org.model,
      params: { ...AI_GENERATION_DEFAULTS, ...org.params },
      streaming: org.streaming,
      safety: org.safety,
    };
  }

  /** Replace the org defaults (admin). */
  async setOrgDefaults(defaults: AiOrgDefaults, updatedBy: string): Promise<AiOrgDefaults> {
    const existing = (await this.orgRepo.find({ take: 1 }))[0];
    const row =
      existing ?? this.orgRepo.create({ provider: defaults.provider, model: defaults.model });
    row.provider = defaults.provider;
    row.model = defaults.model;
    row.params = defaults.params;
    row.streaming = defaults.streaming;
    row.safety = defaults.safety;
    row.updatedBy = updatedBy;
    await this.orgRepo.save(row);
    return this.getOrgDefaults();
  }

  /** A user's stored overrides (empty object if none). */
  async getUserOverrides(userId: string): Promise<AiUserOverrides> {
    const row = await this.overrideRepo.findOne({ where: { userId } });
    if (row === null) {
      return {};
    }
    return {
      provider: row.provider ?? undefined,
      model: row.model ?? undefined,
      params: row.params ?? undefined,
      streaming: row.streaming ?? undefined,
    };
  }

  /** Upsert a user's overrides. */
  async setUserOverrides(userId: string, overrides: AiUserOverrides): Promise<AiUserOverrides> {
    const row =
      (await this.overrideRepo.findOne({ where: { userId } })) ??
      this.overrideRepo.create({ userId });
    row.provider = overrides.provider ?? null;
    row.model = overrides.model ?? null;
    row.params = overrides.params ?? null;
    row.streaming = overrides.streaming ?? null;
    await this.overrideRepo.save(row);
    return this.getUserOverrides(userId);
  }

  /**
   * The effective config for a user: env → org → user, clamped + validated.
   * `requestParams` are per-call overrides applied last (also clamped).
   */
  async resolveForUser(
    userId: string,
    requestParams?: AiGenerationParams,
  ): Promise<AiResolvedConfig> {
    const org = await this.getOrgDefaults();
    const user = await this.getUserOverrides(userId);

    const provider = user.provider ?? org.provider;
    const requestedModel = user.model ?? org.model;
    const model = this.registry.resolveModel(provider, requestedModel);

    const mergedParams: AiGenerationParams = {
      ...AI_GENERATION_DEFAULTS,
      ...org.params,
      ...user.params,
      ...requestParams,
    };

    return {
      provider,
      model: model.id,
      params: this.clampParams(mergedParams, model.maxOutputTokens),
      streaming: user.streaming ?? org.streaming,
      safety: org.safety,
    };
  }

  /** Clamp every generation param to safe bounds (and maxTokens to the model). */
  private clampParams(
    params: AiGenerationParams,
    modelMaxOutput: number,
  ): AiResolvedConfig['params'] {
    return {
      temperature: clampAiParam(
        params.temperature ?? AI_GENERATION_DEFAULTS.temperature,
        AI_PARAM_BOUNDS.temperature,
      ),
      topP: clampAiParam(params.topP ?? AI_GENERATION_DEFAULTS.topP, AI_PARAM_BOUNDS.topP),
      maxTokens: Math.min(
        clampAiParam(
          params.maxTokens ?? AI_GENERATION_DEFAULTS.maxTokens,
          AI_PARAM_BOUNDS.maxTokens,
        ),
        modelMaxOutput,
      ),
      frequencyPenalty: clampAiParam(
        params.frequencyPenalty ?? AI_GENERATION_DEFAULTS.frequencyPenalty,
        AI_PARAM_BOUNDS.frequencyPenalty,
      ),
      presencePenalty: clampAiParam(
        params.presencePenalty ?? AI_GENERATION_DEFAULTS.presencePenalty,
        AI_PARAM_BOUNDS.presencePenalty,
      ),
      stop: (params.stop ?? []).slice(0, AI_PARAM_BOUNDS.maxStopSequences),
    };
  }
}
