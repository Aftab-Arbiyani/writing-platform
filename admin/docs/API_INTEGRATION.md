# Qalam Admin — API Integration

The admin app talks to the frozen `v1` backend at `${VITE_API_URL}` (default
`http://localhost:4000/api/v1`). **All HTTP goes through one client** —
`src/lib/api-client.ts`. Components never call `fetch`; feature `api/*.ts` layers
call `api.*` and feature hooks call those.

## The client (`src/lib/api-client.ts`)

- Typed `fetch` wrapper: `api.get/post/patch/put/delete<T>(path, opts)` →
  `Promise<ApiResult<T>> = { data, meta }`. Unwraps the envelope
  `{ success, data, meta } | { success:false, error:{ code, message, … } }`.
- Throws a typed **`ApiError`** on any non-success — branch on `.code` (from
  `@qalam/shared` `ERROR_CODES`), never on message. `.status`, `.details`,
  `.requestId` are available.
- **Auth**: the access token is held **in memory only** (never localStorage); the
  refresh token rides an httpOnly cookie sent via `credentials:'include'`.
- **Single-flight refresh**: a recoverable 401 triggers one shared refresh + one
  retry; terminal auth codes (`AUTH_TOKEN_INVALID`, `AUTH_SESSION_REVOKED`,
  `AUTH_REFRESH_REUSED`) or a failed refresh end the session via the registered
  `onUnauthorized` handler. 403 is never retried.
- **AbortController**: every read passes `signal`; query hooks pass `({ signal })`
  so navigations cancel in-flight requests.
- **Exports** (`downloadX` helpers in `audit`, `settings`, `analytics`) are the
  _only_ sanctioned raw `fetch` — export endpoints stream raw CSV/JSON (not the
  envelope). They still send the Bearer token + cookie and revoke the object URL
  after download.

## Query configuration (`src/lib/query-client.ts`)

| Option                 | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| `staleTime`            | 30 s default (per-hook overrides: 15 s–5 min)                        |
| `refetchOnWindowFocus` | **false** (admin data is not tab-switch sensitive)                   |
| `retry`                | **4xx never retried**; else up to 2 (auth/validation/404 don't heal) |
| `mutations.retry`      | **false**                                                            |

`keepPreviousData` is used on paginated/filtered lists so the table doesn't blank
between pages/filters. The system-analytics query polls (`refetchInterval` 30 s).

## Query keys & invalidation (`src/lib/query-keys.ts`)

One central factory `qk.*` per namespace (`auth`, `dashboard`, `users`,
`moderation`, `audit`, `settings`, `analytics`). Mutations invalidate by
namespace (`qk.<ns>.all`), so a change refreshes every dependent list/detail
consistently. Feature-flag toggles use **optimistic updates** with rollback.

## Endpoint map (by feature)

| Feature    | Endpoints                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| auth       | `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`                                                                              |
| dashboard  | `GET /analytics/platform`, `GET /admin/queues`, `GET /admin/system-notifications`, `GET /health`                                           |
| users      | `GET/PATCH /admin/users[/:id]`, `POST /admin/users/bulk-actions`, `GET /admin/users/export`                                                |
| moderation | `GET/PATCH /admin/reports[/:id]`, `/reports/bulk-actions`, `/reports/statistics`, `/reports/trends`, `/reports/export`, `/admin/appeals*`  |
| audit      | `GET /admin/audit-logs[/:id]`, `/audit-logs/statistics`, `/audit-logs/export`                                                              |
| settings   | `GET/PATCH /admin/settings[/:category]`, `/admin/feature-flags*`, `/admin/maintenance`                                                     |
| analytics  | `GET /admin/analytics/{overview,users,content,engagement,moderation,system,export}`, reuses `/analytics/trending`, `/admin/reports/trends` |

## Error → UX mapping

| HTTP    | Handling                                                         |
| ------- | ---------------------------------------------------------------- |
| 401     | Silent refresh + retry; terminal → session-end dialog → `/login` |
| 403     | Section shows a "Not authorized" state; route guard shows `/403` |
| 404     | Empty/not-found state per surface                                |
| 422     | Field/inline validation errors from `error.details`              |
| 429     | Surfaced via toast; not retried                                  |
| 5xx     | Retry (≤2) then an error state with a Retry button               |
| offline | Detected (`navigator.onLine`) → offline empty state + Retry      |

`getErrorMessage(error)` maps `ApiError.code` to friendly copy (`src/lib/errors.ts`,
`error-messages.ts`); the request id is exposed for support.
