import { type ReactElement, Fragment } from 'react';

import { useProfileById } from '@/hooks/use-profile';

import { shortId } from '../hooks/use-collaborator-identity';
import { segmentBody } from '../lib/mention-text';

/**
 * A stored comment body, with its `@<uuid>` mentions rendered as names (P-2, docs/48 §5.1).
 *
 * **This is the other half of composing a mention, not a follow-up to it.** The wire format keeps the
 * mention as an id inside the body precisely so the name can be resolved fresh — which means any
 * surface that prints a body without resolving shows 37 characters of hex to a human. Shipping the
 * composer without this would put raw UUIDs in front of real users, reintroducing in a new place the
 * exact defect **B3** had just finished removing (docs/45 §4.13).
 *
 * The lookup is B3's `GET /users/by-id/:id`, keyed per user, so a thread where three people mention
 * each other twenty times costs three requests — and they are the same three the author headers
 * already resolved, so in practice it costs nothing extra.
 *
 * `whitespace-pre-wrap` lives on the caller, and each literal run is wrapped in `<bdi>` so a mixed
 * Urdu/English comment does not reorder around a Latin handle.
 */
export interface MentionBodyProps {
  body: string;
}

export function MentionBody({ body }: MentionBodyProps): ReactElement {
  const segments = segmentBody(body);
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <bdi key={index}>{segment.value}</bdi>
        ) : (
          <Fragment key={index}>
            <MentionToken userId={segment.userId} />
          </Fragment>
        ),
      )}
    </>
  );
}

/**
 * One resolved mention.
 *
 * Shows `@handle` — the same token the composer inserts, so a mention reads identically to the person
 * who wrote it and the person who reads it, and a writer who retypes one from memory gets a real
 * mention rather than plain text. The pen name is carried on `title`/`aria-label`, which is where the
 * fuller identity belongs on an inline run of prose.
 *
 * **An unresolvable id degrades to B3's floor, never below it.** A deleted account, a private profile
 * the viewer cannot see, or a failed lookup renders the short-id fragment — recognisably an id rather
 * than a name — and never a full UUID and never a fabricated name.
 */
function MentionToken({ userId }: { userId: string }): ReactElement {
  const { data: profile } = useProfileById(userId);
  const handle = profile?.username;
  const label = handle ?? shortId(userId);

  return (
    <span
      className="text-accent font-medium"
      // The pen name is the identity; the handle is the token. Both, when both are known.
      title={profile?.penName ? `${profile.penName} (@${handle})` : undefined}
      aria-label={profile?.penName ? `mention of ${profile.penName}` : `mention of ${label}`}
      data-testid="comment-mention"
    >
      @{label}
    </span>
  );
}
