/** Minimal RFC-4180 CSV serialization for the streaming user export. */

/** Escapes one cell — quotes values containing comma, quote, or newline. */
export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Serializes an ordered value list into one CSV line (with trailing newline). */
export function csvLine(values: readonly unknown[]): string {
  return `${values.map(csvEscape).join(',')}\n`;
}
