/**
 * Reusable context-building architecture (AF1). A "context provider" turns a
 * named request (`{ type, params }`) into a text fragment that gets prepended to
 * the model prompt. Future context sources — Current Piece, Previous Chapters,
 * Genres, Language, Author Preferences — plug in by registering a
 * {@link ContextProvider} under the {@link AI_CONTEXT_PROVIDERS} token from
 * their owning module (no change to the AI module, no cross-module repo import).
 * Conversation history is threaded as real messages by the orchestrator (via the
 * conversation service), not flattened into a fragment.
 */

/** A caller's request for one piece of context. */
export interface ContextRequest {
  type: string;
  params?: Record<string, unknown>;
}

/** The scope a builder resolves against (who is asking). */
export interface AiContextScope {
  userId: string;
}

/** A resolved context fragment. */
export interface ContextFragment {
  /** Short label used when composing the fragment into the prompt. */
  label: string;
  text: string;
}

/** A pluggable source of prompt context. */
export interface ContextProvider {
  /** The `type` this provider answers (matches `ContextRequest.type`). */
  readonly type: string;
  /** Build the fragment, or return null if there is nothing to contribute. */
  build(
    params: Record<string, unknown>,
    scope: AiContextScope,
  ): Promise<ContextFragment | null> | ContextFragment | null;
}

/** Multi-provider DI token — every context provider registers under it. */
export const AI_CONTEXT_PROVIDERS = Symbol('AI_CONTEXT_PROVIDERS');
