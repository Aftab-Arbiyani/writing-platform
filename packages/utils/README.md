# @umberleaf/utils

Pure functions — _how to compute_ (ADR §2). **Zero runtime dependencies**, no I/O, no state.

| Module         | Contents                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `slugify`      | Unicode-aware `slugify(input, { maxLength })` (Devanagari/Arabic-script safe) + `appendSuffix(slug, suffix, maxLength)` for uniqueness suffixes |
| `reading-time` | `countWords(text)` (unicode + CJK aware) and `readingTime(wordCount, wpm = 200)` → seconds                                                      |
| `clamp`        | Numeric `clamp(value, min, max)`                                                                                                                |
| `is-defined`   | `isDefined(v)` type guard for `.filter()` narrowing                                                                                             |

## What belongs here vs `@umberleaf/shared` — keep disjoint

- **Here:** behavior — deterministic input→output functions, unit-tested with Vitest.
- **`@umberleaf/shared`:** facts — enums, limits, error codes, regex literals. No functions.

Run tests: `pnpm --filter @umberleaf/utils test`.
