import { beforeEach, describe, expect, it } from 'vitest';
import type { AiStreamEvent } from '@qalam/api-types';

import { useAiStreamStore } from './ai-stream.store';

describe('useAiStreamStore', () => {
  beforeEach(() => {
    useAiStreamStore.getState().reset();
  });

  it('begins a stream (streaming status, cleared text)', () => {
    useAiStreamStore.getState().appendDelta('stale');
    useAiStreamStore.getState().begin();
    const state = useAiStreamStore.getState();
    expect(state.status).toBe('streaming');
    expect(state.text).toBe('');
  });

  it('accumulates deltas and captures start metadata', () => {
    const store = useAiStreamStore.getState();
    store.begin();
    store.onStart({ type: 'start', provider: 'openai', model: 'gpt-4o' } as AiStreamEvent);
    store.appendDelta('Hel');
    store.appendDelta('lo');
    const state = useAiStreamStore.getState();
    expect(state.text).toBe('Hello');
    expect(state.provider).toBe('openai');
    expect(state.model).toBe('gpt-4o');
  });

  it('finalizes on done with usage', () => {
    const store = useAiStreamStore.getState();
    store.begin();
    store.onDone({
      type: 'done',
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    } as AiStreamEvent);
    const state = useAiStreamStore.getState();
    expect(state.status).toBe('done');
    expect(state.usage?.totalTokens).toBe(3);
  });

  it('records an error code', () => {
    const store = useAiStreamStore.getState();
    store.begin();
    store.onError('AI_PROVIDER_ERROR');
    expect(useAiStreamStore.getState().status).toBe('error');
    expect(useAiStreamStore.getState().errorCode).toBe('AI_PROVIDER_ERROR');
  });
});
