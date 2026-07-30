import type { Response } from 'express';

/**
 * Provider-independent Server-Sent-Events helpers (AF1). The streaming completion
 * endpoint uses these to emit the neutral AF1 stream protocol (`start` / `delta`
 * / `progress` / `done` / `error`) regardless of which provider produced the
 * tokens. Cancellation is handled by the caller wiring `req`/`res` 'close' to an
 * AbortController; timeouts by composing `AbortSignal.timeout` (see the
 * orchestrator) — these helpers only format the wire.
 */

/** Write the SSE response headers and flush them so the stream opens promptly. */
export function initSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable proxy buffering (nginx) so tokens are not held back.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/** Emit one SSE event: `event: <type>` + a JSON `data:` payload. */
export function sendSse(res: Response, type: string, data: Record<string, unknown>): void {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

/** Emit an SSE comment heartbeat to keep idle connections open. */
export function sendSseHeartbeat(res: Response): void {
  res.write(': keep-alive\n\n');
}
