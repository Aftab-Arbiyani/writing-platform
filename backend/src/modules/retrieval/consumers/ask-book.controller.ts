import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { initSse, sendSse } from '../../ai/streaming/sse.util';
import { Permissions } from '../../permissions/permissions.decorator';
import { AskBookDto } from '../dto/retrieval-request.dto';
import { AskBookResponseDto } from '../dto/retrieval-response.dto';
import { AskBookService } from './ask-book.service';

/**
 * Ask My Book (AF4). Grounded Q&A over a story's knowledge graph. Requires `ai.use`; gated
 * by the AskBook feature. Answers cite retrieved evidence. `POST /ai/ask` buffers; `POST
 * /ai/ask/stream` streams tokens over SSE (reusing the AF1 SSE protocol) after an initial
 * `sources` event carrying the citations.
 */
@ApiTags('ai-ask')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(RateLimitGuard)
export class AskBookController {
  constructor(private readonly askBook: AskBookService) {}

  @Post('ask')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('aiCompletion')
  @ApiOperation({
    summary:
      'Ask a grounded question about a story; the answer cites retrieved graph evidence. ' +
      'Errors: AI_DISABLED, AI_FEATURE_DISABLED, AI_USAGE_LIMIT_EXCEEDED, STORY_NOT_FOUND.',
  })
  @ApiOkResponse({ type: AskBookResponseDto })
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskBookDto,
  ): Promise<AskBookResponseDto> {
    return this.askBook.ask(user.id, dto);
  }

  @Post('ask/stream')
  @Permissions(PERMISSIONS.AiUse)
  @RateLimit('aiCompletion')
  @ApiOperation({
    summary:
      'Stream a grounded answer over SSE: `sources` (citations) → `start` → `delta`* → ' +
      '`done` | `error`. Aborting the request cancels generation.',
  })
  async askStream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskBookDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    // Prime the generator BEFORE opening the SSE stream so pre-stream failures
    // (feature disabled, STORY_NOT_FOUND) surface as a normal error envelope, not an
    // SSE frame with a 200 status.
    const iterator = this.askBook.streamAsk(user.id, dto, abort.signal);
    const first = await iterator.next();

    initSse(res);
    try {
      if (first.done !== true) {
        sendSse(res, first.value.kind, first.value as unknown as Record<string, unknown>);
      }
      for (let step = await iterator.next(); step.done !== true; step = await iterator.next()) {
        sendSse(res, step.value.kind, step.value as unknown as Record<string, unknown>);
      }
    } catch (error) {
      sendSse(res, 'error', {
        code: extractCode(error),
        message: (error as Error).message,
      });
    } finally {
      res.end();
    }
  }
}

function extractCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'AI_STREAM_ERROR';
}
