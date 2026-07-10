import { Fragment, type ReactElement } from 'react';

/**
 * Highlights the matched query substring inside a suggestion/result label (docs/06 §3.6 —
 * "suggestion highlighting"). Case- and accent-insensitive-ish: we match on a locale-lowercased
 * comparison but slice the ORIGINAL string so the display keeps its casing and script. Only the
 * first occurrence is marked (suggestions are short). No match → the text renders plain.
 *
 * `dir="auto"` on the wrapper lets Urdu/Hindi labels lay out RTL/LTR by their own content.
 */
export function HighlightText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}): ReactElement {
  const needle = query.trim().toLocaleLowerCase();
  const haystack = text.toLocaleLowerCase();
  const at = needle.length > 0 ? haystack.indexOf(needle) : -1;

  if (at === -1) {
    return (
      <span dir="auto" className={className}>
        {text}
      </span>
    );
  }

  const before = text.slice(0, at);
  const match = text.slice(at, at + needle.length);
  const after = text.slice(at + needle.length);

  return (
    <span dir="auto" className={className}>
      {before}
      <mark className="rounded-[3px] bg-accent/15 text-ink">{match}</mark>
      <Fragment>{after}</Fragment>
    </span>
  );
}
