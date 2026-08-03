import { AiFeature } from '@qalam/shared';
import { QButton } from '@qalam/ui';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';

import { useAiAvailability } from '@/hooks/use-ai-availability';

import { useRetrievalSuggestions } from '../hooks/use-retrieval';
import type { SearchMode } from '../hooks/use-search-query-params';

/**
 * The engine switch (W5/AF4). Two buttons rather than a select, because there are exactly two and
 * both should be one keystroke away; `aria-pressed` carries the state, so a screen reader hears
 * which engine is running rather than inferring it from styling.
 *
 * **It renders even when AI is unavailable**, and that is deliberate: hiding it would make a
 * dark-launched deployment look like a build without the feature, and the notice behind it explains
 * the real reason (off / not enabled / out of allowance / needs a plan). Only the gate decides
 * whether a request is made — never the presence of the control.
 */
export function SearchModeToggle({
  mode,
  onSelect,
}: {
  mode: SearchMode;
  onSelect: (mode: SearchMode) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Search engine">
      <QButton
        size="sm"
        variant={mode === 'keyword' ? 'primary' : 'ghost'}
        icon={Search}
        aria-pressed={mode === 'keyword'}
        onClick={() => {
          onSelect('keyword');
        }}
      >
        Keyword
      </QButton>
      <QButton
        size="sm"
        variant={mode === 'ai' ? 'primary' : 'ghost'}
        icon={Sparkles}
        aria-pressed={mode === 'ai'}
        onClick={() => {
          onSelect('ai');
        }}
      >
        AI search
      </QButton>
    </div>
  );
}

/**
 * Query suggestions in AI mode (`GET /ai/search/suggestions`) — the titles that best match the
 * current query, offered as the next thing to try.
 *
 * **Arranged as a row beside the results, not as a dropdown while typing.** Mobile shows the
 * dropdown because its search runs on submit; this page's field debounces straight into the URL, so
 * the ranked results are already on screen by the time a dropdown could open — it would flicker in
 * and out on a 300ms timer and cover the answer it duplicates. Same endpoint, same purpose (help the
 * reader phrase the query), different arrangement for a live-results page: [48 §4.1] territory, and
 * recorded there rather than left as an unexplained divergence.
 *
 * The prefix is the COMMITTED query from the URL, so this fires once per settled search rather than
 * per keystroke — `search` is rate-limited at 30/min per user and shared with keyword search.
 */
export function AiSearchSuggestions({
  prefix,
  onPick,
}: {
  prefix: string;
  onPick: (query: string) => void;
}): ReactElement | null {
  const availability = useAiAvailability(AiFeature.SemanticSearch);
  const { data } = useRetrievalSuggestions(prefix);
  // The query itself always comes back as its own best match; offering it as an alternative to
  // itself is noise, so it is dropped.
  const suggestions = (data ?? [])
    .filter((s) => s.trim().toLowerCase() !== prefix.trim().toLowerCase())
    .slice(0, 6);

  if (availability !== 'available' || suggestions.length === 0) return null;

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
