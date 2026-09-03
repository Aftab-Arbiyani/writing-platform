import { ExplorerView, StoryAnalysisKind } from '@qalam/shared';
import { QButton, QCard, QEmptyState, QErrorState, QSkeleton, QTag, cn } from '@qalam/ui';
import { Network, Square } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { AllowanceHint } from '@/components/allowance-hint';
import { getErrorMessage } from '@/lib/errors';
import { useAiEditorTarget } from '@/stores/ai-editor-target.store';

import { EXPLORER_VIEWS, explorerViewSpec, nodeTypeLabel } from '../lib/explorer-views';
import { useMapStory, useStoryExplorer } from '../hooks/use-story-explorer';
import { GraphNodeDetail } from './graph-node-detail';
import { ModelDisclosureNote } from './model-disclosure-note';

/** What each step of a map run is doing, in the writer's words rather than the enum's. */
const ANALYSIS_LABELS: Record<StoryAnalysisKind, string> = {
  [StoryAnalysisKind.Character]: 'characters',
  [StoryAnalysisKind.Plot]: 'plot',
  [StoryAnalysisKind.World]: 'world',
  [StoryAnalysisKind.Style]: 'style',
  [StoryAnalysisKind.Timeline]: 'timeline',
};

/**
 * The Story Map tab (D5, was Story Explorer) — the AF3 knowledge graph as eight structured views,
 * plus the action that fills it.
 *
 * Mobile's `story_explorer_screen.dart` is the reference: a chip row picks the view, the body is a
 * list of node cards, and selecting one opens its detail with tappable neighbours. Same parts, same
 * order; the detail replaces the list in place rather than opening a sheet (see `GraphNodeDetail`).
 *
 * **D5 added "Map this story", and without it the rest of this file was decoration.** The graph is
 * only ever written by `POST /story-intelligence/:storyId/analyze`, and no client could reach that
 * route — so every one of these eight views rendered "nothing here yet" on every story, forever
 * (48 §3.22d). Promoting Story Map to the paid tier's headline meant giving it something to show.
 *
 * **Everything here renders from graph objects the server projected — nothing is re-derived.** The
 * view selector re-fetches rather than filtering a cached graph, because the server projects a
 * different node set per view: `relationships` drops unconnected characters and `timeline` arrives
 * pre-sorted by `data.order`, neither of which a client-side filter over one payload could
 * reproduce. Node order is the server's; this never re-sorts.
 */
export function StoryMapTab({ storyId }: { storyId: string }): ReactElement {
  const [view, setView] = useState<ExplorerView>(ExplorerView.Characters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const explorer = useStoryExplorer({ storyId, view });
  const map = useMapStory(storyId);
  const target = useAiEditorTarget((s) => s.target);

  const spec = explorerViewSpec(view);
  const nodes = explorer.data?.nodes ?? [];
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const pickView = (next: ExplorerView): void => {
    setView(next);
    // A node id is only meaningful inside the view it came from; carrying the selection across
    // would land on "not found" whenever the next projection excludes it.
    setSelectedId(null);
  };

  /**
   * The draft's text is read at click time from the editor seam, not held in state — the writer
   * keeps typing, and mapping a version they have moved on from would build a graph of a story that
   * no longer exists. The server takes the content from the client for the same reason the analyze
   * route does: an unsaved draft is still a story worth mapping.
   */
  const runMap = (): void => {
    const context = target?.getContext();
    if (!context) return;
    void map.run(context.documentText, context.title);
  };

  const nothingToMap = (target?.getContext()?.documentText ?? '').trim() === '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <QButton
            size="sm"
            variant="primary"
            icon={Network}
            disabled={map.isRunning || nothingToMap}
            onClick={runMap}
          >
            {nodes.length === 0 ? 'Map this story' : 'Re-map this story'}
          </QButton>
          {map.isRunning ? (
            <QButton size="sm" variant="ghost" icon={Square} onClick={map.cancel}>
              Stop
            </QButton>
          ) : null}
        </div>

        {/*
          A step counter rather than a spinner: five sequential model calls take long enough that a
          writer needs to know it is moving and roughly how much is left. `aria-live` because the
          only thing that changes during the run is this line.
        */}
        {map.progress ? (
          <p role="status" aria-live="polite" className="text-sm text-ink-secondary">
            Step {map.progress.step} of {map.progress.total}
            {map.progress.analysis === null
              ? '…'
              : ` — reading the ${ANALYSIS_LABELS[map.progress.analysis]}…`}
          </p>
        ) : null}

        {map.error === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {map.error}
          </p>
        )}

        {/*
          One run spends five analyses, so the writer sees the count before they start it rather
          than discovering mid-run that they had four left — which is also why the server reserves
          the whole run up front and refuses with QUOTA_EXCEEDED before the first call.
        */}
        <AllowanceHint featureKey="storyAnalysesPerMonth" />
      </div>

      {/* Not a tablist: these are inside an AntD `Tabs` panel already, and a nested tablist makes
          the drawer's tab semantics ambiguous. A pressed-state button group says the same thing
          and keeps arrow keys behaving the way they do everywhere else in the panel. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Story Map view">
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
          title="Couldn’t open the story map."
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

      <ModelDisclosureNote />
    </div>
  );
}
