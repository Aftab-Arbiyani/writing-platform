import { PieceStatus } from '@qalam/shared';
import { cn, QButton, QCard, QEmptyState, QErrorState, QSkeleton, QSpinner } from '@qalam/ui';
import { PenLine, PlayCircle } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';

import { PieceRow } from '../components/piece-row';
import {
  PIECE_LIMIT_NOTICE_ID,
  PieceAllowanceCount,
  PieceLimitNotice,
} from '../components/piece-limit-notice';
import { useMyPieces } from '../hooks/use-my-pieces';
import { usePieceLimit } from '../hooks/use-piece-limit';
import { resolvePieceAllowanceNotice } from '../lib/piece-allowance';

const TABS: readonly { status: PieceStatus; label: string }[] = [
  { status: PieceStatus.Draft, label: 'Drafts' },
  { status: PieceStatus.Published, label: 'Published' },
  { status: PieceStatus.Scheduled, label: 'Scheduled' },
  { status: PieceStatus.Archived, label: 'Archived' },
];

const EMPTY: Record<PieceStatus, { title: string; description: string }> = {
  [PieceStatus.Draft]: {
    title: 'Nothing here yet — that’s how every book starts.',
    description: 'Your drafts will wait for you here.',
  },
  [PieceStatus.Published]: {
    title: 'No published pieces yet.',
    description: 'When you publish, your work appears here.',
  },
  [PieceStatus.Scheduled]: {
    title: 'Nothing scheduled.',
    description: 'Schedule a piece and it will wait here until its time.',
  },
  [PieceStatus.Archived]: {
    title: 'Nothing archived.',
    description: 'Archived pieces rest here, out of the feed.',
  },
};

const STATUS_VALUES = Object.values(PieceStatus);
function isStatus(value: string | null): value is PieceStatus {
  return value !== null && (STATUS_VALUES as string[]).includes(value);
}

export function DashboardPage(): ReactElement {
  usePageTitle('Your writing');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = isStatus(params.get('status'))
    ? (params.get('status') as PieceStatus)
    : PieceStatus.Draft;

  const query = useMyPieces(status);
  // B4 (docs/45 §4.9). The server decides; this only renders its verdict. While the read is in
  // flight there is no notice and the create control stays live — the create itself is still
  // checked server-side, so an optimistic moment costs a 402 at worst, whereas holding the button
  // back on every page load costs everyone who is nowhere near their cap.
  const allowance = usePieceLimit();
  const notice = resolvePieceAllowanceNotice(allowance.data);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  const mostRecentDraft = status === PieceStatus.Draft ? items[0] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-ink">Your writing</h1>
        <div className="flex items-center gap-3">
          <PieceAllowanceCount notice={notice} />
          {mostRecentDraft ? (
            <QButton
              variant="secondary"
              size="sm"
              icon={PlayCircle}
              onClick={() => {
                void navigate(`${ROUTES.write}/${mostRecentDraft.id}`);
              }}
            >
              Continue writing
            </QButton>
          ) : null}
          <QButton
            variant="primary"
            size="sm"
            icon={PenLine}
            disabled={notice.blocked}
            aria-describedby={notice.blocked ? PIECE_LIMIT_NOTICE_ID : undefined}
            onClick={() => {
              void navigate(ROUTES.write);
            }}
          >
            New draft
          </QButton>
        </div>
      </div>

      <PieceLimitNotice notice={notice} />

      <nav aria-label="Your pieces by status" className="border-line border-b">
        <ul className="flex gap-1 overflow-x-auto">
          {TABS.map(({ status: value, label }) => {
            const active = value === status;
            return (
              <li key={value}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('status', value);
                        return next;
                      },
                      { replace: true },
                    );
                  }}
                  className={cn(
                    'relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors',
                    active ? 'text-ink' : 'text-ink-secondary hover:text-ink',
                  )}
                >
                  {label}
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {query.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading your pieces"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <QCard key={i} padding="md" className="flex items-center gap-4">
              <QSkeleton
                variant="rect"
                width={64}
                height={64}
                radius="md"
                className="hidden sm:block"
              />
              <div className="flex-1">
                <QSkeleton variant="title" width="50%" />
                <QSkeleton variant="text" lines={1} width="30%" className="mt-2" />
              </div>
            </QCard>
          ))}
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load your pieces."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : items.length === 0 ? (
        <QEmptyState
          icon={PenLine}
          title={EMPTY[status].title}
          description={EMPTY[status].description}
          action={
            status === PieceStatus.Draft ? (
              // Reachable while blocked: a downgraded author with 100 published pieces and no
              // drafts sees this tab empty. The notice above explains it; the button must not
              // promise an editor that cannot save.
              <QButton
                variant="primary"
                disabled={notice.blocked}
                aria-describedby={notice.blocked ? PIECE_LIMIT_NOTICE_ID : undefined}
                onClick={() => {
                  void navigate(ROUTES.write);
                }}
              >
                Write your first draft
              </QButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-ink-muted tabular-nums">
            {items.length}
            {query.hasNextPage ? '+' : ''}{' '}
            {TABS.find((t) => t.status === status)?.label.toLowerCase()}
          </p>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <PieceRow key={item.id} item={item} />
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {query.isFetchingNextPage ? (
            <div role="status" aria-label="Loading more" className="flex justify-center py-4">
              <QSpinner />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
