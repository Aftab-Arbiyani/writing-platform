import type { AiConversationExport } from '@qalam/api-types';

/**
 * Turning the export route's JSON into a file the reader actually gets (W8 C1).
 *
 * `GET /ai/conversations/:id/export` returns an ordinary enveloped JSON body — no
 * `Content-Disposition`, no stream (`ai-conversations.controller.ts:123-133`) — so the browser will
 * not download anything on its own. The client has to build the file, which is why this is a
 * pure function plus one DOM-touching caller: the naming and serialization are unit-testable, and
 * only `triggerDownload` needs a document.
 *
 * Mobile does the platform-appropriate equivalent of the same idea — it copies the JSON to the
 * clipboard (`ai_conversation_screen.dart:186-199`), since a phone has nowhere useful to put a file.
 * Recorded as an accepted layout difference in docs/48 §4.1 rather than a parity gap.
 */

/** Serialized export text — pretty-printed, because a human opens this file. */
export function serializeExport(document: AiConversationExport): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * A stable, filesystem-safe filename for an export.
 *
 * Derived from the title when there is one, since `Untitled conversation.json` twice over is worse
 * than useless; falls back to the id, which always exists. The id suffix keeps two exports of
 * same-titled conversations distinct.
 */
export function exportFilename(document: AiConversationExport): string {
  const slug = (document.title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug === ''
    ? `qalam-conversation-${document.id}.json`
    : `qalam-conversation-${slug}-${document.id.slice(0, 8)}.json`;
}

/**
 * Hand the serialized document to the browser as a download.
 *
 * The object URL is revoked on the next macrotask rather than immediately: Safari has historically
 * cancelled an in-flight download when its blob URL is revoked synchronously after `click()`.
 */
export function triggerDownload(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Serialize + name + download, in one call — what the export button does. */
export function downloadConversationExport(document: AiConversationExport): void {
  triggerDownload(exportFilename(document), serializeExport(document));
}
