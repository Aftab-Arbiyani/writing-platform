import { ExplorerView } from '@qalam/shared';

/**
 * The eight Story Explorer views (W9), in mobile's order, with the copy each one's empty state
 * needs (`story_explorer_screen.dart`, `retrieval_vocab.dart`).
 *
 * **The set is closed on the client on purpose.** `GET /ai/explorer/:storyId/:view` does not reject
 * an unknown view — `normalizeView` silently returns the whole graph instead
 * (`story-explorer.service.ts:53-57`) — so a view this list gets wrong would render a plausible
 * wrong answer rather than an error. Ordering it from `@qalam/shared`'s `ExplorerView` keeps the
 * values themselves owned by the wire contract.
 *
 * Each view's `empty` is written separately rather than derived from the label because the server
 * PROJECTS rather than filters, and two of the projections would otherwise lie:
 *
 * - **`relationships` is not "characters"** — it drops every character with no relationship edge
 *   (`story-explorer.service.ts:68-80`), so a story with a full cast and no mapped relationships is
 *   legitimately empty here while `characters` is full.
 * - **`map` empty means no graph at all**, not "nothing of this type", so it is the one view whose
 *   empty state points at the fix (analyse the story) rather than at the absence.
 */
export interface ExplorerViewSpec {
  view: ExplorerView;
  label: string;
  /** The empty-state body for this view. Titles are shared; only the reason differs. */
  empty: string;
}

/**
 * The whole graph. Named separately because it is also the FALLBACK spec: the server answers an
 * unrecognised view with the map (`story-explorer.service.ts:53-57`), so resolving to anything else
 * would let the label disagree with the payload on screen.
 */
const MAP_SPEC: ExplorerViewSpec = {
  view: ExplorerView.Map,
  label: 'Story map',
  empty: 'Analyse this story to build its knowledge graph.',
};

export const EXPLORER_VIEWS: readonly ExplorerViewSpec[] = [
  {
    view: ExplorerView.Characters,
    label: 'Characters',
    empty: 'No characters have been found in this story yet.',
  },
  {
    view: ExplorerView.Relationships,
    label: 'Relationships',
    empty: 'No relationships have been mapped between this story’s characters yet.',
  },
  {
    view: ExplorerView.Timeline,
    label: 'Timeline',
    empty: 'No events have been placed on this story’s timeline yet.',
  },
  {
    view: ExplorerView.Locations,
    label: 'Locations',
    empty: 'No locations have been found in this story yet.',
  },
  {
    view: ExplorerView.Events,
    label: 'Events',
    empty: 'No events have been found in this story yet.',
  },
  {
    view: ExplorerView.Objects,
    label: 'Objects',
    empty: 'No objects have been found in this story yet.',
  },
  {
    view: ExplorerView.Concepts,
    label: 'Concepts',
    empty: 'No concepts have been found in this story yet.',
  },
  MAP_SPEC,
];

/** The spec for `view`; an unrecognised one resolves to the map, exactly as the server's does. */
export function explorerViewSpec(view: ExplorerView): ExplorerViewSpec {
  return EXPLORER_VIEWS.find((spec) => spec.view === view) ?? MAP_SPEC;
}

/**
 * Friendly label for a knowledge-graph node type or a structured-data key.
 *
 * A near-duplicate of `features/search/lib/retrieval-labels.ts` on purpose: a feature may never
 * import another feature (docs/26 §4), and the two lists are not the same list — search labels
 * result FACETS (`piece`, `author`, `genre`), this labels graph NODE types plus the arbitrary keys
 * inside a node's `data`. Both stay open-ended, because the wire's type set is open by design
 * (docs/36) and a type this build has never heard of is expected, not a bug.
 */
const NODE_TYPE_LABELS: Record<string, string> = {
  character: 'Character',
  location: 'Location',
  organization: 'Organization',
  object: 'Object',
  event: 'Event',
  concept: 'Concept',
  chapter: 'Chapter',
};

export function nodeTypeLabel(type: string): string {
  const known = NODE_TYPE_LABELS[type];
  if (known !== undefined) return known;
  if (type === '') return 'Entity';
  // `firstChapter` → "First chapter"; `arc` → "Arc". Keys inside `data` are camelCase.
  const spaced = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return `${spaced[0]?.toUpperCase() ?? ''}${spaced.slice(1)}`;
}
