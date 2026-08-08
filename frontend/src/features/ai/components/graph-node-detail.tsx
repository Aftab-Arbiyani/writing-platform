import type { StoryGraphEdge, StoryGraphNode } from '@qalam/api-types';
import { QButton, QTag } from '@qalam/ui';
import { ArrowLeft, Link2, Quote } from 'lucide-react';
import type { ReactElement } from 'react';

import { nodeTypeLabel } from '../lib/explorer-views';

/** A node reachable from the current one, and the edge label that connects them. */
interface Neighbour {
  node: StoryGraphNode;
  relation: string;
}

/**
 * Every distinct node joined to `node` by an edge in `edges`, each with the label of the FIRST edge
 * that reaches it.
 *
 * **Only the loaded view's edges are considered, and that is the server's shape rather than a
 * shortcut here.** A typed explorer view returns just the edges whose two endpoints are both inside
 * it (`story-explorer.service.ts:87-89`), so a character's location neighbour genuinely is not in
 * the `characters` payload — the Story map view is where the whole graph is. Mobile's sheet walks
 * exactly the same view-local edge set (`story_node_sheet.dart:39-53`).
 */
function neighboursOf(node: StoryGraphNode, edges: StoryGraphEdge[], nodes: StoryGraphNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: Neighbour[] = [];
  for (const edge of edges) {
    const otherId =
      edge.sourceId === node.id ? edge.targetId : edge.targetId === node.id ? edge.sourceId : null;
    if (otherId === null || seen.has(otherId)) continue;
    seen.add(otherId);
    const other = byId.get(otherId);
    if (other) out.push({ node: other, relation: edge.label === '' ? edge.type : edge.label });
  }
  return out;
}

/** A `data` value rendered for reading. Arrays are the common case (traits, goals, aliases). */
function formatFact(value: unknown): string {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ');
  return String(value);
}

/** `data` entries worth showing — an empty string, an empty array or a null is not a fact. */
function factsOf(node: StoryGraphNode): [string, unknown][] {
  return Object.entries(node.data).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== '';
  });
}

/**
 * One knowledge-graph node in full (W9) — its structured `data`, its evidence, and its neighbours as
 * controls that move to them, so the writer can walk the graph.
 *
 * Mobile shows this as a bottom sheet over the list (`story_node_sheet.dart`); here it REPLACES the
 * list inside the AI drawer, with a back control. A nested dialog inside an open drawer is the one
 * arrangement neither AntD nor a screen reader handles gracefully, and the drawer already provides
 * the "layer over the editor" that mobile's sheet is for. Interaction is identical either way: pick
 * a neighbour, land on that node (docs/48 §4.1 arrangement difference).
 *
 * Pure presentation over the already-loaded view — it makes no request of its own.
 */
export function GraphNodeDetail({
  node,
  edges,
  nodes,
  onBack,
  onSelectNode,
}: {
  node: StoryGraphNode;
  edges: StoryGraphEdge[];
  nodes: StoryGraphNode[];
  onBack: () => void;
  onSelectNode: (nodeId: string) => void;
}): ReactElement {
  const neighbours = neighboursOf(node, edges, nodes);
  const facts = factsOf(node);

  return (
    <div className="flex flex-col gap-4">
      <QButton variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
        Back to list
      </QButton>

      <div className="flex items-start justify-between gap-3">
        <h3 dir="auto" className="font-serif text-lg font-semibold text-ink">
          {node.name}
        </h3>
        <QTag color="accent">{nodeTypeLabel(node.type)}</QTag>
      </div>

      {node.aliases.length > 0 ? (
        <p dir="auto" className="text-sm text-ink-muted">
          Also known as {node.aliases.join(', ')}
        </p>
      ) : null}

      {node.summary !== '' ? (
        <p dir="auto" className="text-sm text-ink-secondary">
          {node.summary}
        </p>
      ) : null}

      {facts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-ink">Details</h4>
          {/* A description list, not a table: these are label/value pairs of an entity, and the key
              set differs per node type (traits/goals/arc for a character, rules for a concept). */}
          <dl className="flex flex-col gap-1.5 text-sm">
            {facts.map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-x-2">
                <dt className="text-ink-muted">{nodeTypeLabel(key)}</dt>
                <dd dir="auto" className="min-w-0 flex-1 text-ink">
                  {formatFact(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {node.evidence.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-ink">Evidence</h4>
          <ul className="flex flex-col gap-1.5">
            {node.evidence.slice(0, 4).map((item, index) => (
              <li
                key={`${item.chapterRef ?? ''}:${item.quote}:${String(index)}`}
                className="flex items-start gap-2"
              >
                <Quote
                  size={13}
                  strokeWidth={1.75}
                  className="mt-1 shrink-0 text-ink-muted"
                  aria-hidden
                />
                <p dir="auto" className="text-sm text-ink-secondary">
                  {item.quote}
                  {item.chapterRef === null ? null : (
                    <span className="text-ink-muted"> — {item.chapterRef}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {neighbours.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-ink">Connected</h4>
          <ul className="flex flex-wrap gap-1.5">
            {neighbours.slice(0, 20).map((neighbour) => (
              <li key={neighbour.node.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectNode(neighbour.node.id);
                  }}
                  className="focus-visible:outline-accent inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-secondary transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Link2 size={14} strokeWidth={1.75} aria-hidden />
                  <span dir="auto" className="truncate">
                    {neighbour.node.name}
                  </span>
                  {/* The edge label is the whole point of the connection and is invisible on a
                      chip that only shows a name, so it is spoken rather than dropped. */}
                  <span className="sr-only">{` (${neighbour.relation})`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
