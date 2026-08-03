import type { ConfigType } from '@nestjs/config';
import { AiFinishReason, AiMessageRole, AiProvider } from '@qalam/shared';

import type { aiConfig } from '../../../../config/ai.config';
import { AiProviderNotConfiguredException } from '../../ai.exceptions';
import type { ProviderCompletionRequest, ProviderStreamChunk } from '../provider.types';
import { chunkText, STUB_JSON_TEXT, STUB_PASSAGE, StubAdapter } from './stub.adapter';

function makeConfig(stubEnabled: boolean): ConfigType<typeof aiConfig> {
  return {
    defaultProvider: AiProvider.Stub,
    defaultModel: '',
    requestTimeoutMs: 30_000,
    dailyTokenLimit: 100_000,
    monthlyTokenLimit: 1_000_000,
    providers: { [AiProvider.Stub]: { apiKey: '', baseUrl: '' } },
    stub: { enabled: stubEnabled },
  } as unknown as ConfigType<typeof aiConfig>;
}

function build(enabled = true): StubAdapter {
  return new StubAdapter(makeConfig(enabled));
}

function request(overrides: Partial<ProviderCompletionRequest> = {}): ProviderCompletionRequest {
  return {
    model: 'stub-1',
    messages: [{ role: AiMessageRole.User, content: 'Continue this scene.' }],
    temperature: 0.7,
    topP: 1,
    maxTokens: 1_024,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: [],
    jsonMode: false,
    ...overrides,
  };
}

async function collect(stream: AsyncIterable<ProviderStreamChunk>): Promise<ProviderStreamChunk[]> {
  const chunks: ProviderStreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * The safety property first, because it is the one that matters if anything else here is wrong: this
 * adapter serves canned text as if a model wrote it, so a deployment that has not explicitly opted in
 * must not be able to reach it.
 */
describe('StubAdapter — off unless explicitly enabled', () => {
  it('is not configured by default', () => {
    expect(build(false).isConfigured()).toBe(false);
  });

  it('refuses both entry points while unconfigured', async () => {
    const adapter = build(false);
    await expect(adapter.complete(request())).rejects.toBeInstanceOf(
      AiProviderNotConfiguredException,
    );
    // `stream` is a generator, so the refusal surfaces on first iteration, not at the call.
    await expect(collect(adapter.stream(request()))).rejects.toBeInstanceOf(
      AiProviderNotConfiguredException,
    );
  });

  it('serves the `stub` provider id, which is absent from the implemented-provider list', () => {
    expect(build().provider).toBe(AiProvider.Stub);
  });
});

describe('StubAdapter — deterministic output', () => {
  it('returns the same text for the same request, every time', async () => {
    const adapter = build();
    const first = await adapter.complete(request());
    const second = await adapter.complete(request());
    expect(first.text).toBe(STUB_PASSAGE);
    expect(second.text).toBe(first.text);
    expect(second.usage).toEqual(first.usage);
  });

  it('streams the identical text it would have buffered', async () => {
    const adapter = build();
    const buffered = await adapter.complete(request());
    const streamed = (await collect(adapter.stream(request())))
      .map((chunk) => chunk.delta)
      .join('');
    expect(streamed).toBe(buffered.text);
  });

  it('echoes the requested model back rather than inventing one', async () => {
    expect((await build().complete(request({ model: 'stub-1' }))).model).toBe('stub-1');
  });
});

describe('StubAdapter — the stream shape a client has to consume', () => {
  it('arrives in many deltas, not one blob', async () => {
    const chunks = await collect(build().stream(request()));
    const deltas = chunks.filter((chunk) => chunk.delta !== '');
    // The whole point of the adapter: a single-chunk stream would leave the client's accumulation
    // path unexercised, which is the path most likely to be wrong.
    expect(deltas.length).toBeGreaterThan(5);
  });

  it('reports finishReason + usage only on the terminal chunk', async () => {
    const chunks = await collect(build().stream(request()));
    const terminal = chunks.at(-1);
    expect(chunks.slice(0, -1).every((chunk) => chunk.finishReason === undefined)).toBe(true);
    expect(terminal?.delta).toBe('');
    expect(terminal?.finishReason).toBe(AiFinishReason.Stop);
    expect(terminal?.usage?.outputTokens).toBeGreaterThan(0);
    expect(terminal?.usage?.totalTokens).toBe(
      (terminal?.usage?.inputTokens ?? 0) + (terminal?.usage?.outputTokens ?? 0),
    );
  });

  it('counts the prompt it was given, so usage accounting has real numbers to record', async () => {
    const short = await build().complete(request());
    const long = await build().complete(
      request({ messages: [{ role: AiMessageRole.User, content: 'x'.repeat(4_000) }] }),
    );
    expect(long.usage.inputTokens).toBeGreaterThan(short.usage.inputTokens);
    expect(long.usage.outputTokens).toBe(short.usage.outputTokens);
  });

  it('stops promptly when the caller aborts, without a terminal chunk', async () => {
    const controller = new AbortController();
    const chunks: ProviderStreamChunk[] = [];
    for await (const chunk of build().stream(request({ signal: controller.signal }))) {
      chunks.push(chunk);
      controller.abort(); // a writer pressing Stop after the first delta
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.finishReason).toBeUndefined();
  });
});

describe('StubAdapter — honest edge cases', () => {
  it('truncates to the caller budget and says `length`, rather than lying about it', async () => {
    const result = await build().complete(request({ maxTokens: 4 }));
    expect(result.finishReason).toBe(AiFinishReason.Length);
    expect(result.text).toBe(STUB_PASSAGE.slice(0, 16));
  });

  it('answers valid JSON when jsonMode is set', async () => {
    const result = await build().complete(request({ jsonMode: true }));
    expect(result.text).toBe(STUB_JSON_TEXT);
    expect(() => JSON.parse(result.text) as unknown).not.toThrow();
  });

  it('answers JSON when the prompt asks for it without the flag (how AF3 asks)', async () => {
    const result = await build().complete(
      request({
        messages: [
          { role: AiMessageRole.System, content: 'Respond with JSON matching the schema.' },
          { role: AiMessageRole.User, content: 'Analyse this chapter.' },
        ],
      }),
    );
    expect(result.text).toBe(STUB_JSON_TEXT);
  });
});

describe('chunkText', () => {
  it('is lossless — the chunks rejoin to the input exactly', () => {
    expect(chunkText(STUB_PASSAGE).join('')).toBe(STUB_PASSAGE);
    expect(chunkText(STUB_JSON_TEXT).join('')).toBe(STUB_JSON_TEXT);
  });

  it('splits text with no whitespace at all, which is why the width is in characters', () => {
    expect(chunkText('a'.repeat(100)).length).toBeGreaterThan(1);
  });

  it('is total on the empty string', () => {
    expect(chunkText('')).toEqual([]);
  });
});
