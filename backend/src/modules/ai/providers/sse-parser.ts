/**
 * Minimal Server-Sent-Events reader over a `fetch` response body (AF1). Yields
 * each `data:` payload string as it arrives; ignores `event:`/`id:`/comment
 * lines (the provider payloads carry their own type discriminator). Sufficient
 * for OpenAI, Anthropic, and Gemini streams, which each emit one JSON object per
 * `data:` line. Stops promptly when `signal` aborts and always releases the
 * reader lock.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) {
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        if (line.startsWith('data:')) {
          yield line.slice(5).trimStart();
        }
        newlineIndex = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
