import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiProvider, PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
import { PROVIDER_LABELS } from '../ai.constants';
import { AiConfigService } from '../config/ai-config.service';
import { AiPromptPreviewDto, UpdateAiOrgDefaultsDto } from '../dto/ai-request.dto';
import {
  AiModelDto,
  AiOrgDefaultsDto,
  AiPromptPreviewResponseDto,
  AiPromptTemplateDto,
  AiProviderInfoDto,
  AiUsageResponseDto,
} from '../dto/ai-response.dto';
import type { ResolvedPrompt } from '../prompts/prompt-registry.service';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { ModelRegistryService } from '../registry/model-registry.service';
import { UsageService } from '../tokens/usage.service';

/**
 * Admin AI platform surface (AF1) — requires `ai.manage`. Read the provider +
 * model registry, manage org-default config, inspect/preview prompt templates,
 * and view a user's usage. API keys are NEVER returned (only a `configured`
 * flag).
 */
@ApiTags('admin-ai')
@ApiBearerAuth()
@Controller('admin/ai')
@UseGuards(RateLimitGuard)
export class AdminAiController {
  constructor(
    private readonly providers: ProviderRegistryService,
    private readonly models: ModelRegistryService,
    private readonly config: AiConfigService,
    private readonly prompts: PromptRegistryService,
    private readonly usage: UsageService,
  ) {}

  @Get('providers')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'AI providers: configured/implemented status + their models.' })
  @ApiOkResponse({ type: [AiProviderInfoDto] })
  listProviders(): AiProviderInfoDto[] {
    const implemented = this.providers.implementedProviders();
    return Object.values(AiProvider).map((provider) => ({
      provider,
      displayName: PROVIDER_LABELS[provider] ?? provider,
      configured: this.providers.isConfigured(provider),
      implemented: implemented.includes(provider),
      models: this.models.listByProvider(provider),
    }));
  }

  @Get('models')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'All registered AI models.' })
  @ApiOkResponse({ type: [AiModelDto] })
  listModels(): AiModelDto[] {
    return this.models.list();
  }

  @Get('config')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Organization AI defaults.' })
  @ApiOkResponse({ type: AiOrgDefaultsDto })
  getConfig(): Promise<AiOrgDefaultsDto> {
    return this.config.getOrgDefaults();
  }

  @Put('config')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Replace the organization AI defaults.' })
  @ApiOkResponse({ type: AiOrgDefaultsDto })
  setConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAiOrgDefaultsDto,
  ): Promise<AiOrgDefaultsDto> {
    return this.config.setOrgDefaults(
      {
        provider: dto.provider,
        model: dto.model,
        params: dto.params,
        streaming: dto.streaming,
        safety: dto.safety ?? {},
      },
      user.id,
    );
  }

  @Get('prompts')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Active prompt templates.' })
  @ApiOkResponse({ type: [AiPromptTemplateDto] })
  listPrompts(): AiPromptTemplateDto[] {
    return this.prompts.listActive().map(toPromptDto);
  }

  @Get('prompts/:key/versions')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'All versions of a prompt template.' })
  @ApiOkResponse({ type: [AiPromptTemplateDto] })
  listVersions(@Param('key') key: string): AiPromptTemplateDto[] {
    return this.prompts.listVersions(key).map(toPromptDto);
  }

  @Post('prompts/:key/preview')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Render a prompt template with sample variables.' })
  @ApiOkResponse({ type: AiPromptPreviewResponseDto })
  preview(@Param('key') key: string, @Body() dto: AiPromptPreviewDto): AiPromptPreviewResponseDto {
    return this.prompts.preview(key, dto.variables, dto.version);
  }

  @Get('usage/:userId')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: "A user's AI usage summary." })
  @ApiOkResponse({ type: AiUsageResponseDto })
  usageForUser(@Param('userId', ParseUUIDPipe) userId: string): Promise<AiUsageResponseDto> {
    return this.usage.getSummary(userId);
  }
}

function toPromptDto(prompt: ResolvedPrompt): AiPromptTemplateDto {
  return {
    key: prompt.key,
    version: prompt.version,
    category: prompt.category,
    description: prompt.description,
    variables: prompt.variables,
    active: prompt.active,
    updatedAt: prompt.updatedAt.toISOString(),
  };
}
