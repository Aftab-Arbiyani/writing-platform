import { PERMISSIONS } from '@qalam/shared';
import { QButton, QCard, QErrorState, QSkeleton, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { usePermission } from '@/hooks/use-permission';
import { usePieceResponses, useWriteResponse } from '@/hooks/use-piece-responses';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { draftPath, piecePath, profilePath, ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';
import type { PieceResponse } from '@/types/conversation';

/**
 * A piece's responses (W7a, docs/45 §4.4) — the pieces written back to it, and the way in.
 *
 * **A response is a piece, so writing one ends in the EDITOR, not in a composer.**
 * `POST /pieces/:id/responses` takes `CreatePieceDto` and creates a linked DRAFT; the flow navigates
 * to that draft at `/write/:draftId`. This mirrors mobile exactly (`responses_screen.dart:68-85`)
 * and is why there is no inline response box: a response deserves the same tools a piece gets.
 *
 * **The list is public; only the write is gated.** `GET /pieces/:id/responses` is `@Public()` +
 * `OptionalAuthGuard`, so a signed-out reader sees every response and an honest sign-in link.
 * `POST` needs `piece.create`, which `usePermission` reflects as an affordance — the server still
 * decides, so a refusal is surfaced rather than assumed away.
 */
export interface ResponseListProps {
  pieceId: string;
  /** The parent's language — a response to an Urdu piece is drafted in Urdu (`CreatePieceDto`). */
  languageCode: string;
  /** The parent's title, so the new draft opens already named rather than "Untitled". */
  parentTitle: string;
  /** Where sign-in returns to — the piece's own canonical path. */
  returnTo: string;
}

export function ResponseList({
  pieceId,
  languageCode,
  parentTitle,
  returnTo,
}: ResponseListProps): ReactElement {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const canWrite = usePermission(PERMISSIONS.PieceCreate);
  const navigate = useNavigate();
  const toast = useToast();
  const query = usePieceResponses(pieceId);
  const write = useWriteResponse(pieceId);

  const responses = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  const startResponse = (): void => {
    write.mutate(
      { languageCode, title: `Response to “${parentTitle}”` },
      {
        onSuccess: (draft) => {
          void navigate(draftPath(draft.id));
        },
        onError: (err) => {
          // The refusal this surfaces is a 403 the affordance hint could not see — a customized
          // grant, or a trust restriction. NOT the plan piece cap: B4 gates `POST /pieces` only,
          // and `ResponsesService.create` reaches `PiecesService.createDraft` directly, below
          // `assertPieceAllowance`, so a capped author can still answer a piece by design
          // (`pieces.service.ts`, "capping those would block a reader from replying").
          toast.error('Couldn’t start your response', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <section aria-labelledby="piece-responses-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="piece-responses-heading" className="text-ink font-serif text-2xl font-semibold">
          Responses
        </h2>
        {authed && canWrite ? (
          <QButton size="sm" loading={write.isPending} onClick={startResponse}>
            Write a response
          </QButton>
        ) : null}
      </div>

      {!authed ? (
        <p className="text-ink-secondary text-sm">
          <Link
            to={`${ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`}
            className="text-accent hover:underline"
          >
            Sign in
          </Link>{' '}
          to write a response.
        </p>
      ) : null}

      {query.isLoading ? (
        <div role="status" aria-busy="true" aria-label="Loading responses">
          <QSkeleton variant="text" lines={3} />
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load the responses."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : responses.length === 0 ? (
        <p className="text-ink-secondary text-sm">
          No responses yet. Writing one starts a piece of your own.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {responses.map((response) => (
            <li key={response.pieceId}>
              <ResponseRow response={response} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} aria-hidden />
      {query.hasNextPage ? (
        <div>
          <QButton
            variant="secondary"
            size="sm"
            loading={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            More responses
          </QButton>
        </div>
      ) : null}
    </section>
  );
}

/**
 * One response row. A response IS a piece, so the title opens the reader for it — by slug where
 * one exists (published pieces have one) and by id otherwise, which is what `piecePath` resolves.
 */
function ResponseRow({ response }: { response: PieceResponse }): ReactElement {
  return (
    <QCard>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">
          <Link
            to={piecePath(response.slug ?? response.pieceId)}
            className="text-ink hover:underline"
          >
            <bdi>{response.title}</bdi>
          </Link>
        </h3>
        {response.subtitle ? (
          <p className="text-ink-secondary text-sm">
            <bdi>{response.subtitle}</bdi>
          </p>
        ) : null}
        <p className="text-ink-muted text-xs">
          <Link to={profilePath(response.author.username)} className="hover:underline">
            <bdi>{response.author.penName ?? `@${response.author.username}`}</bdi>
          </Link>
          {' · '}
          <time dateTime={response.respondedAt}>{formatRelativeTime(response.respondedAt)}</time>
        </p>
      </div>
    </QCard>
  );
}
