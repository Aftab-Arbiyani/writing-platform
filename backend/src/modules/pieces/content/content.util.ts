import { countWords, extractPlainText, readingTime } from '@qalam/utils';

/** Derived, recomputed on every content write (docs 04 §5) — via @qalam/utils. */
export interface ContentMetrics {
  contentText: string;
  wordCount: number;
  readingTimeSeconds: number;
}

/** Flattens the TipTap doc to text and derives word count + reading time. */
export function deriveContentMetrics(content: unknown): ContentMetrics {
  const contentText = extractPlainText(content);
  const wordCount = countWords(contentText);
  return { contentText, wordCount, readingTimeSeconds: readingTime(wordCount) };
}
