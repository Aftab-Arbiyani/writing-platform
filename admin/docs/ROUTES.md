# Qalam Admin — Route Inventory

Every section route is a **lazy** route module (`lazy: () => import(...)`), so each
admin area is its own JS chunk (`src/app/router.tsx`). Guards are pathless layout
routes composed with visual layouts, so redirect logic is never duplicated. Role
floors are **minimums** (a higher role inherits lower-role access); a below-floor
role gets an honest 403, not a redirect. Guards are UX gating only — every backend
endpoint re-checks server-side.

## Role ladder

`user < moderator < admin < super_admin`

## Routes

| Path              | Section            | Role floor      | Chunk / status         |
| ----------------- | ------------------ | --------------- | ---------------------- |
| `/login`          | Sign in            | guest only      | `login`                |
| `/`               | → `/dashboard`     | moderator       | redirect               |
| `/dashboard`      | Dashboard          | moderator       | `dashboard`            |
| `/pieces`         | Pieces             | moderator       | placeholder            |
| `/prompts`        | Prompts            | moderator       | placeholder            |
| `/reports`        | Moderation         | moderator       | `reports`              |
| `/users`          | User management    | **admin**       | `users`                |
| `/card-templates` | Card templates     | admin           | placeholder            |
| `/languages`      | Languages          | admin           | placeholder            |
| `/featured`       | Featured writers   | admin           | placeholder            |
| `/analytics`      | Platform analytics | admin           | `analytics` (+ECharts) |
| `/audit-logs`     | Audit logs         | admin           | `audit-logs`           |
| `/settings`       | System settings    | admin           | `settings`             |
| `/moderators`     | Moderators         | admin           | placeholder            |
| `/roles`          | Roles & RBAC       | **super_admin** | `roles`                |
| `/401`            | Unauthorized       | always          | inline                 |
| `/403`            | Forbidden          | authenticated   | inline                 |
| `/offline`        | Offline            | authenticated   | inline                 |
| `*`               | Not found          | authenticated   | inline                 |

## Guard composition

```
AppRoot (mounts SessionExpiredDialog)
├─ /401  (always reachable — deep links)
├─ RequireGuest → AuthLayout → /login
└─ RequireAuth → RequireRole(min=moderator) → AdminShell (errorElement = AdminErrorBoundary)
   ├─ moderator: /dashboard /pieces /prompts /reports
   ├─ RequireRole(min=admin): /users /card-templates /languages /featured
   │                          /analytics /audit-logs /settings /moderators
   └─ RequireRole(min=super_admin): /roles
```

- `RequireAuth` — redirects to `/login` (preserving the return path) when there
  is no session.
- `RequireRole min={…}` — renders the section when `role rank ≥ floor`, else the
  403 page.
- `RequireGuest` — bounces an authenticated user away from `/login`.

The navigation (`src/components/nav-config.ts`) renders only the groups/items the
viewer's role can enter, so a moderator never sees `/roles` or `/settings`.

## Deep-link / section state

Within a section, tabs/filters/pagination live in the URL query string
(`?tab=`, `?section=`, `?page=`, filter params) via `useAdminTable`, so any admin
view is shareable and reload-safe.
