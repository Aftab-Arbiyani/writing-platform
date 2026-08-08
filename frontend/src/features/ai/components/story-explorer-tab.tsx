import { ExplorerView } from '@qalam/shared';
import { QCard, QEmptyState, QErrorState, QSkeleton, QTag, cn } from '@qalam/ui';
import { Network } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';

import { EXPLORER_VIEWS, explorerViewSpec, nodeTypeLabel } from '../lib/explorer-views';
import { useStoryExplorer } from '../hooks/use-story-explorer';
import { GraphNodeDetail } from './graph-node-detail';

/**
 * The Story Explorer tab (W9/AF4) — the AF3 knowledge graph as eight structured views, read-only.
 *
 * Mobile's `story_explorer_screen.dart` is the reference: a chip row picks the view, the body is a
 * list of node cards, and selecting one opens its detail with tappable neighbours. Same parts, same
 * order; the detail replaces the list in place rather than opening a sheet (see `GraphNodeDetail`).
 *
 * **Everything here renders from graph objects the server projected — nothing is re-derived.** The
 * view selector re-fetches rather than filtering a cached graph, because the server projects a
 * different node set per view: `relationships` drops unconnected characters and `timeline` arrives
 * pre-sorted by `data.order`, neither of which a client-side filter over one payload could
 * reproduce. Node order is the server's; this never re-sorts.
 */
export function StoryExplorerTab({ storyId }: { storyId: string }): ReactElement {
  const [view, setView] = useState<ExplorerView>(ExplorerView.Characters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const explorer = useStoryExplorer({ storyId, view });
  const spec = explorerViewSpec(view);
  const nodes = explorer.data?.nodes ?? [];
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const pickView = (next: ExplorerView): void => {
    setView(next);
    // A node id is only meaningful inside the view it came from; carrying the selection across
    // would land on "not found" whenever the next projection excludes it.
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Not a tablist: these are inside an AntD `Tabs` panel already, and a nested tablist makes
          the drawer's tab semantics ambiguous. A pressed-state button group says the same thing
          and keeps arrow keys behaving the way they do everywhere else in the panel. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Explorer view">
        {EXPLORER_VIEWS.map((entry) => {
          const active = entry.view === view;
          return (
            <button
              key={entry.view}
              type="button"
              aria-pressed={active}
              onClick={() => {
                pickView(entry.view);
              }}
              className={cn(
                'focus-visible:outline-accent inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                active
                  ? 'border-accent bg-accent/12 text-accent-on-tint'
                  : 'border-line bg-surface text-ink-secondary hover:border-ink-muted hover:text-ink',
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {explorer.isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading the story graph">
          <QSkeleton variant="rect" height={72} />
          <QSkeleton variant="rect" height={72} />
          <QSkeleton variant="rect" height={72} />
        </div>
      ) : explorer.isError ? (
        <QErrorState
          minHeight={220}
          title="Couldn’t open the story graph."
          description={getErrorMessage(explorer.error)}
          onRetry={() => {
            void explorer.refetch();
          }}
        />
      ) : selected ? (
        <GraphNodeDetail
          node={selected}
          nodes={nodes}
          edges={explorer.data?.edges ?? []}
          onBack={() => {
            setSelectedId(null);
          }}
          onSelectNode={setSelectedId}
        />
      ) : nodes.length === 0 ? (
        <QEmptyState
          minHeight={220}
          icon={Network}
          title="Nothing here yet"
          description={spec.empty}
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={spec.label}>
          {nodes.map((node) => (
            <QCard as="li" key={node.id} padding="none" interactive>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(node.id);
                }}
                className="focus-visible:outline-accent flex w-full flex-col items-start gap-1 rounded-md p-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span dir="auto" className="font-medium text-ink">
                    {node.name}
                  </span>
                  <QTag size="sm">{nodeTypeLabel(node.type)}</QTag>
                </span>
                {node.summary === '' ? null : (
                  <span dir="auto" className="line-clamp-2 text-sm text-ink-secondary">
                    {node.summary}
                  </span>
                )}
              </button>
            </QCard>
          ))}
        </ul>
      )}
    </div>
  );
}
