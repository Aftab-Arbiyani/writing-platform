/**
 * The conversation layer's public surface (W7a, docs/45 §4.4) — piece comments + responses.
 *
 * App-level because its two ends sit in different features (docs/26 §4): the thread is read on the
 * reader, and writing a response ends in the editor. `PieceConversation` is what a page composes;
 * the parts are exported for tests and for any later surface that needs one without the other.
 */
export { PieceConversation } from './piece-conversation';
export type { PieceConversationProps } from './piece-conversation';
export { CommentList } from './comment-list';
export { CommentItem } from './comment-item';
export { CommentComposer } from './comment-composer';
export { ResponseList } from './response-list';
