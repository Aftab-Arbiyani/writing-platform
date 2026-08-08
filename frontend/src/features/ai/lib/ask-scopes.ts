import { AskScope } from '@qalam/shared';

/**
 * The nine Ask My Book scopes, with mobile's labels verbatim (`retrieval_vocab.dart:9-29`).
 *
 * A scope is not a filter the client applies — it is sent on the request and decides which graph
 * node types the server retrieves evidence from (`askScopeNodeTypes`, `@qalam/shared`), so the
 * values here must match the wire exactly. They come from `AskScope` for that reason; only the copy
 * is local.
 *
 * `book` is first and is the server's default when the key is omitted (`AskBookDto.scope`), so the
 * UI's initial selection agrees with what an unspecified request would have done.
 */
export const ASK_SCOPES: readonly { scope: AskScope; label: string }[] = [
  { scope: AskScope.Book, label: 'Whole book' },
  { scope: AskScope.Chapter, label: 'This chapter' },
  { scope: AskScope.Scene, label: 'This scene' },
  { scope: AskScope.Character, label: 'A character' },
  { scope: AskScope.Timeline, label: 'Timeline' },
  { scope: AskScope.Relationship, label: 'A relationship' },
  { scope: AskScope.World, label: 'The world' },
  { scope: AskScope.Theme, label: 'Themes' },
  { scope: AskScope.Lore, label: 'Lore' },
];
