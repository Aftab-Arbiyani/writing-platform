import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AiMessageRole, PERMISSIONS } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { AppException } from '../../../common/exceptions/app.exception';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
import { AiFeatureService } from '../ai-feature.service';
import { AiConfigService } from '../config/ai-config.service';
import { AiCompletionRequestDto, UpdateAiUserOverridesDto } from '../dto/ai-request.dto';
import {
  AiCompletionResponseDto,
  AiConfigResponseDto,
  AiFeaturesResponseDto,
  AiModelDto,
} from '../dto/ai-response.dto';
import type { CompletionInput } from '../orchestration/ai-completion.service';
import { AiCompletionService } from '../orchestration/ai-completion.service';
import { ModelRegistryService } from '../registry/model-registry.service';
import { initSse, sendSse } from '../streaming/sse.util';

/**
 * User-facing AI surface (AF1). Gated by the global `JwtAuthGuard`; every route
 * needs `ai.use`. Provides feature/flag discovery, effective config + personal
 * overrides, the model list, and the completion endpoints (buffered + SSE
 * streaming). All generation goes through the orchestrator — the client never
 * talks to a provider and never sees an API key.
 *
 * D5 removed `GET /ai/usage/me`: users are no longer shown token counts, and the
 * per-feature allowances that replace them are served by the monetization module,
 * which owns plan limits. Token/cost accounting stays internal — the admin route
 * `GET /admin/ai/usage/:userId` still reads it.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(RateLimitGuard)
export class AiController {
  constructor(
    private readonly completion: AiCompletionService,
    private readonly config: AiConfigService,
    private readonly features: AiFeatureService,
    private readonly models: ModelRegistryService,
  ) {}

  @Get('features')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Which AI features are enabled for you (master flag + your own AI switch + per-feature flags).',
  })
  @ApiOkResponse({ type: AiFeaturesResponseDto })
  // B5 (docs/45 §4.10): the route's contract has always been "enabled **for you**", but until
  // B5 nothing about it was per-caller, so it took no user. It does now — the caller's own
  // "turn AI off" preference is ANDed into `aiEnabled` and every feature's state.
  getFeatures(@CurrentUser() user: AuthenticatedUser): Promise<AiFeaturesResponseDto> {
    return this.features.listFeatureStates(user.id);
  }

  @Get('models')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Registered AI models you can select.' })
  @ApiOkResponse({ type: [AiModelDto] })
  listModels(): AiModelDto[] {
    return this.models.list();
  }

  @Get('config')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Your effective AI config (resolved) + org defaults + your overrides.' })
  @ApiOkResponse({ type: AiConfigResponseDto })
  getConfig(@CurrentUser() user: AuthenticatedUser): Promise<AiConfigResponseDto> {
    return this.buildConfigResponse(user.id);
  }

  @Patch('config')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('write')
  @ApiOperation({ summary: 'Update your personal AI overrides (provider/model/params/streaming).' })
  @ApiOkResponse({ type: AiConfigResponseDto })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAiUserOverridesDto,
  ): Promise<AiConfigResponseDto> {
    await this.config.setUserOverrides(user.id, dto);
    return this.buildConfigResponse(user.id);
  }

  @Post('completions')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('aiCompletion')
  @ApiOperation({
    summary:
      'Run a buffered AI completion. Errors: AI_DISABLED, AI_FEATURE_DISABLED, ' +
      'AI_USAGE_LIMIT_EXCEEDED, AI_PROVIDER_* , AI_MODEL_* , AI_CONTEXT_TOO_LARGE.',
  })
  @ApiOkResponse({ type: AiCompletionResponseDto })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiCompletionRequestDto,
    @Req() req: Request,
  ): Promise<AiCompletionResponseDto> {
    const output = await this.completion.complete(this.toInput(user, dto, req));
    return {
      conversationId: null,
      message: {
        id: output.messageId ?? '',
        role: AiMessageRole.Assistant,
        content: output.content,
        usage: output.usage,
        createdAt: new Date().toISOString(),
      },
      model: output.model,
      provider: output.provider,
      finishReason: output.finishReason,
      usage: output.usage,
      estimatedCostUsd: output.costUsd,
    };
  }

  @Post('completions/stream')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('aiCompletion')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Run a streaming AI completion (SSE: start → delta* → done | error).',
  })
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiCompletionRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    req.on('close', () => abort.abort());
    initSse(res);
    try {
      for await (const event of this.completion.stream(
        this.toInput(user, dto, req, abort.signal),
      )) {
        if (event.kind === 'start') {
          sendSse(res, 'start', {
            provider: event.provider,
            model: event.model,
            conversationId: null,
          });
        } else if (event.kind === 'delta') {
          sendSse(res, 'delta', { text: event.text });
        } else {
          sendSse(res, 'done', {
            finishReason: event.finishReason,
            usage: event.usage,
            estimatedCostUsd: event.costUsd,
            messageId: event.messageId,
          });
        }
      }
    } catch (error) {
      sendSse(res, 'error', {
        code: error instanceof AppException ? error.code : 'AI_STREAM_ERROR',
        message: error instanceof Error ? error.message : 'stream failed',
      });
    } finally {
      res.end();
    }
  }

  private async buildConfigResponse(userId: string): Promise<AiConfigResponseDto> {
    const [resolved, orgDefaults, userOverrides] = await Promise.all([
      this.config.resolveForUser(userId),
      this.config.getOrgDefaults(),
      this.config.getUserOverrides(userId),
    ]);
    return { resolved, orgDefaults, userOverrides };
  }

  private toInput(
    user: AuthenticatedUser,
    dto: AiCompletionRequestDto,
    req: Request,
    signal?: AbortSignal,
  ): CompletionInput {
    const requestId = req.headers['x-request-id'];
    return {
      userId: user.id,
      feature: dto.feature,
      promptKey: dto.promptKey,
      promptVersion: dto.promptVersion,
      promptVariables: dto.promptVariables,
      messages: dto.messages,
      context: dto.context,
      params: dto.params,
      jsonMode: dto.jsonMode,
      requestId: typeof requestId === 'string' ? requestId : undefined,
      signal,
    };
  }
}
