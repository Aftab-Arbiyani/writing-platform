/**
 * HTTP query-string helper matching the backend's DTO expectations (docs/05 §6):
 * omit undefined/null, arrays comma-joined (OR semantics), booleans literal true/false.
 * Build query strings in the feature api/ layer — never hand-concatenate `?a=${x}`.
 */
export type QueryParamValue = string | number | boolean | Array<string | number> | undefined | null;
export type QueryParams = Record<string, QueryParamValue>;

export function buildQueryString(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
