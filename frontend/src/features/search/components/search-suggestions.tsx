import { ArrowUpRight } from 'lucide-react';
import type { ReactElement } from 'react';

import { useRetrievalSuggestions } from '../hooks/use-retrieval';

/**
 * Query suggestions (`GET /ai/search/suggestions`) — the titles that best match the current query,
 * offered as the next thing to try.
 *
 * **Arranged as a row beside the results, not as a dropdown while typing.** Mobile shows the
 * dropdown because its search runs on submit; this page's field debounces straight into the URL, so
 * the ranked results are already on screen by the time a dropdown could open — it would flicker in
 * and out on a 300ms timer and cover the answer it duplicates. Same endpoint, same purpose (help the
 * reader phrase the query), different arrangement for a live-results page: [48 §4.1] territory, and
 * recorded there rather than left as an unexplained divergence.
 *
 * The prefix is the COMMITTED query from the URL, so this fires once per settled search rather than
 * per keystroke — `search` is rate-limited at 30/min per user and shared with the scoped lists.
 *
 * D5 removed the availability gate: the route is public and calls no model, so the only reason to
 * render nothing is having nothing to suggest.
 */
export function SearchSuggestions({
  prefix,
  onPick,
}: {
  prefix: string;
  onPick: (query: string) => void;
}): ReactElement | null {
  const { data } = useRetrievalSuggestions(prefix);
  // The query itself always comes back as its own best match; offering it as an alternative to
  // itself is noise, so it is dropped.
  const suggestions = (data ?? [])
    .filter((s) => s.trim().toLowerCase() !== prefix.trim().toLowerCase())
    .slice(0, 6);

  if (suggestions.length === 0) return null;

  return (
    <nav aria-label="Suggested searches" className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-ink-secondary">Try instead</span>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => {
            onPick(suggestion);
          }}
          className="border-line inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-sm text-ink transition-colors hover:bg-raised"
        >
          <ArrowUpRight
            size={13}
            strokeWidth={1.75}
            className="shrink-0 text-ink-muted"
            aria-hidden
          />
          <span dir="auto" className="truncate">
            {suggestion}
          </span>
        </button>
      ))}
    </nav>
  );
}
