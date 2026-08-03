/**
 * Display labels for AF4 wire vocabulary (W5).
 *
 * Its own module rather than living beside the components that use it: the wire's entity/facet sets
 * are deliberately OPEN (docs/36 — a new type never needs a migration), so this map is pure data that
 * both the search result card and the discover shelves read, and a file that exports components may
 * not also export shared constants (react-refresh).
 */

const ENTITY_TYPE_LABELS: Record<string, string> = {
  piece: 'Story',
  author: 'Author',
  genre: 'Genre',
  tag: 'Topic',
  topic: 'Topic',
  chapter: 'Chapter',
  character: 'Character',
  location: 'Location',
  event: 'Event',
  concept: 'Concept',
  object: 'Object',
  organization: 'Organization',
};

/**
 * Friendly label for a wire entity/facet type. An unknown value title-cases rather than breaking —
 * the sets are open by design, so a type this build has never heard of is expected, not a bug.
 */
export function entityTypeLabel(type: string): string {
  const known = ENTITY_TYPE_LABELS[type];
  if (known !== undefined) return known;
  return type === '' ? 'Result' : `${type[0]?.toUpperCase() ?? ''}${type.slice(1)}`;
}
