import { Injectable } from '@nestjs/common';
import { AiFeature, AiMessageRole, AskScope, RetrievalIntent } from '@qalam/shared';

import { AiCompletionService, AiFeatureService } from '../../ai';
import type { AskBookDto } from '../dto/retrieval-request.dto';
import type { AskBookResponseDto } from '../dto/retrieval-response.dto';
import { EvidenceService } from '../evidence/evidence.service';
import { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import { RetrievalService } from '../retrieval.service';
import type { AskCitation, RetrievalResult } from '../retrieval.types';

/** Streaming events surfaced to the controller (mapped 1:1 to SSE frames). */
export type AskStreamEvent =
  | { kind: 'sources'; citations: AskCitation[]; confidence: number }
  | { kind: 'start'; conversationId: string | null }
  | { kind: 'delta'; text: string }
  | {
      kind: 'done';
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      estimatedCostUsd: number;
      conversationId: string | null;
    }
  | { kind: 'error'; code: string; message: string };

/**
 * Ask My Book (AF4). Grounded Q&A over a story's knowledge graph. It gates the AskBook
 * feature, retrieves scope-appropriate graph evidence (owner-scoped — a foreign/missing
 * story surfaces STORY_NOT_FOUND), then asks the AF1 orchestrator with the ASSEMBLED
 * evidence as context — NEVER the raw question alone — so the answer is grounded and every
 * answer cites the retrieved evidence. Supports both a buffered answer and a token stream.
 */
@Injectable()
export class AskBookService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly completion: AiCompletionService,
    private readonly features: AiFeatureService,
    private readonly evidence: EvidenceService,
    private readonly telemetry: RetrievalTelemetryService,
  ) {}

  async ask(userId: string, dto: AskBookDto): Promise<AskBookResponseDto> {
    await this.features.assertEnabled(AiFeature.AskBook, userId);
    const start = Date.now();
    const scope = dto.scope ?? AskScope.Book;
    const { result, citations } = await this.retrieveForAsk(userId, dto, scope);

    const llmStart = Date.now();
    const output = await this.completion.complete({
      userId,
      feature: AiFeature.AskBook,
      conversationId: dto.conversationId,
      promptKey: 'ask_book.answer',
      promptVariables: { scope, context: result.context.text },
      messages: [{ role: AiMessageRole.User, content: dto.question }],
    });
    const llmLatencyMs = Date.now() - llmStart;

    await this.telemetry.record({
      userId,
      storyId: dto.storyId,
      telemetry: result.telemetry,
      totalLatencyMs: Date.now() - start,
      llmLatencyMs,
      tokenUsage: output.usage.totalTokens,
      status: result.candidates.length === 0 ? 'no_results' : 'ok',
    });

    return {
      storyId: dto.storyId,
      scope,
      answer: output.content,
      citations,
      confidence: result.telemetry.confidence,
      usage: output.usage,
      estimatedCostUsd: output.costUsd,
      conversationId: output.conversationId,
    };
  }

  async *streamAsk(
    userId: string,
    dto: AskBookDto,
    signal?: AbortSignal,
  ): AsyncGenerator<AskStreamEvent> {
    await this.features.assertEnabled(AiFeature.AskBook, userId);
    const start = Date.now();
    const scope = dto.scope ?? AskScope.Book;
    const { result, citations } = await this.retrieveForAsk(userId, dto, scope);

    yield { kind: 'sources', citations, confidence: result.telemetry.confidence };

    const llmStart = Date.now();
    let tokenUsage = 0;
    let conversationId: string | null = null;
    let status: 'ok' | 'failed' = 'ok';
    try {
      for await (const event of this.completion.stream({
        userId,
        feature: AiFeature.AskBook,
        conversationId: dto.conversationId,
        promptKey: 'ask_book.answer',
        promptVariables: { scope, context: result.context.text },
        messages: [{ role: AiMessageRole.User, content: dto.question }],
        signal,
      })) {
        if (event.kind === 'start') {
          conversationId = event.conversationId;
          yield { kind: 'start', conversationId };
        } else if (event.kind === 'delta') {
          yield { kind: 'delta', text: event.text };
        } else if (event.kind === 'done') {
          tokenUsage = event.usage.totalTokens;
          yield {
            kind: 'done',
            usage: event.usage,
            estimatedCostUsd: event.costUsd,
            conversationId,
          };
        }
      }
    } catch (error) {
      status = 'failed';
      const code = extractCode(error);
      yield { kind: 'error', code, message: (error as Error).message };
    } finally {
      await this.telemetry.record({
        userId,
        storyId: dto.storyId,
        telemetry: result.telemetry,
        totalLatencyMs: Date.now() - start,
        llmLatencyMs: Date.now() - llmStart,
        tokenUsage,
        status:
          status === 'failed' ? 'failed' : result.candidates.length === 0 ? 'no_results' : 'ok',
      });
    }
  }

  private async retrieveForAsk(
    userId: string,
    dto: AskBookDto,
    scope: AskScope,
  ): Promise<{ result: RetrievalResult; citations: AskCitation[] }> {
    const result = await this.retrieval.retrieve({
      userId,
      query: dto.question,
      intent: RetrievalIntent.Ask,
      storyId: dto.storyId,
      scope,
      subject: dto.subject,
      limit: 0,
    });
    return { result, citations: this.evidence.toCitations(result.context.evidence) };
  }
}

function extractCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'AI_STREAM_ERROR';
}
