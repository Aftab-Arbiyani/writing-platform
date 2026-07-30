/**
 * Type guard filtering out `null` and `undefined` — narrows in `.filter()`:
 *   const titles: string[] = maybeTitles.filter(isDefined);
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
