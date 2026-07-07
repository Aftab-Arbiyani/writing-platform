# @qalam/shared

Domain vocabulary — _what the domain knows_ (ADR §2). **Zero runtime dependencies.**

| Module         | Contents                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `enums`        | `PieceStatus`, `Visibility`, `Role`, `NotificationType`, `ReportStatus`, `TextDirection` as `as const` objects + union types |
| `error-codes`  | `ERROR_CODES` catalogue (`DOMAIN_REASON`) + `ErrorCode` union                                                                |
| `limits`       | Product constants (`MAX_CLAPS_PER_USER_PER_PIECE = 50`, lengths, page sizes)                                                 |
| `regex`        | `USERNAME_REGEX`, Unicode-aware `HASHTAG_REGEX` / `MENTION_REGEX`                                                            |
| `api-envelope` | `ApiSuccess` / `ApiFailure` / `ApiResponse`, `CursorMeta` / `OffsetMeta`                                                     |

## What belongs here vs `@qalam/utils` — keep disjoint

- **Here:** constants, enums, types, regex _literals_ — facts about the domain. No functions.
- **`@qalam/utils`:** pure _computation_ (`slugify`, `readingTime`) — how to derive values.

If it has behavior, it goes to `utils`; if it needs a dependency, it goes elsewhere entirely.
