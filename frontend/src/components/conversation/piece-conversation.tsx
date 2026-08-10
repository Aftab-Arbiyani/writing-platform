import type { ReactElement } from 'react';

import { CommentList } from './comment-list';
import { ResponseList } from './response-list';

/**
 * The conversation on a piece (W7a, docs/45 §4.4) — comments, then responses, INLINE at the end of
 * the reading page.
 *
 * **This is an accepted layout difference from mobile, and it is recorded** in
 * [48 §4.1](../../../../docs/48_PlatformParityRegister.md) — a claim in a code comment is not a
 * record, which is exactly what §6 step 5 exists to catch. Mobile pushes two separate screens
 * (`comments_screen.dart`, `responses_screen.dart`) from a footer on the reader, because a phone
 * has no room for a thread under an article. A browser page does: keeping the conversation on the
 * piece's own canonical URL is what makes it shareable, linkable and readable without leaving the
 * prose. Same two surfaces, same order as mobile's footer (comments first), same behaviour.
 *
 * App-level, not inside `features/reading` (docs/26 §4): the thread is read on the reader and
 * writing a response ends in `features/writing`'s editor, and a feature may never import another
 * feature. The reader composes this; the route composes the reader.
 */
export interface PieceConversationProps {
  pieceId: string;
  /** The parent's language code — a response inherits it (`CreatePieceDto.languageCode`). */
  languageCode: string;
  parentTitle: string;
  /** The piece's canonical path — where sign-in returns a reader who came here to write. */
  returnTo: string;
}

export function PieceConversation({
  pieceId,
  languageCode,
  parentTitle,
  returnTo,
}: PieceConversationProps): ReactElement {
  return (
    <div className="border-line flex flex-col gap-12 border-t pt-10" id="conversation">
      <CommentList pieceId={pieceId} returnTo={returnTo} />
      <ResponseList
        pieceId={pieceId}
        languageCode={languageCode}
        parentTitle={parentTitle}
        returnTo={returnTo}
      />
    </div>
  );
}
