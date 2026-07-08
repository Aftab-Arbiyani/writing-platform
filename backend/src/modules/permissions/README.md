# Permissions (PBAC)

Permission-Based Access Control. Roles are **collections of permissions**; guards
check permissions, never hardcoded roles. Authentication (JWT/OAuth/refresh/email
verification) is untouched — this is the authorization layer only.

## Backward compatibility

The access token already carries `role` (issued from `RolesService.getEffectiveRole`).
The guard resolves a request's **permissions from that role claim** at request time,
so **no token/payload change** is needed and existing users automatically gain the
permissions of their role. Additive migration (three new tables; `roles`/`user_roles`
untouched).

## Pieces

- `PERMISSIONS` catalogue + `DEFAULT_ROLE_PERMISSIONS` + `permissionSatisfies` live in
  `@qalam/shared` (vocabulary shared with clients).
- `PermissionFactory` — wildcard matcher/engine (`*`, `module.*`, exact; AND across a route's list).
- `PermissionResolver` — a principal's effective grant set: rank-stacked role grants
  (a role inherits every lower-ranked role's, preserving RBAC semantics) ∪ direct user
  grants. DB-backed + in-memory cache + static fallback (`DEFAULT_ROLE_PERMISSIONS`) so
  authZ works even pre-seed.
- `PermissionGuard` — reads `@Permissions` metadata, resolves, denies with
  `AUTH_PERMISSION_DENIED` (403) listing the missing codes. No metadata → pass-through.
- `@Permissions(...codes)` — replaces `@Roles`. Bundles the metadata,
  `UseGuards(PermissionGuard)`, and an OpenAPI `x-required-permissions` extension.
- `PermissionsService` — seeds the catalogue (upsert) + role mappings (seed-if-empty),
  on boot (`onApplicationBootstrap`, best-effort) and via `run-seeds`.

## Resolution order

1. Super-admin wildcard (`*` grant) → allow.
2. Direct user permission (`user_permissions`, future overrides).
3. Role permission (rank-stacked `role_permissions`).
4. Deny (`AUTH_PERMISSION_DENIED`).

## Default role permissions

| Role        | Grants (rank-stacked at resolve time)                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| super_admin | `*`                                                                                                                                              |
| admin       | `user.* profile.* piece.* comment.* report.* settings.* taxonomy.* notification.manage analytics.view admin.dashboard` (+ moderator + user)      |
| moderator   | `report.review report.resolve piece.archive piece.feature comment.delete comment.lock` (+ user)                                                  |
| user        | `profile.update piece.create piece.update piece.publish piece.archive piece.delete comment.create clap.create bookmark.manage collection.manage` |

## Tables

`permissions` (catalogue), `role_permissions` (role_name → code, wildcards allowed, no
FK to catalogue), `user_permissions` (per-user overrides, future). Data-aware checks
(ownership/visibility) stay in services (docs 13 §4.3) — the guard only answers "does
this principal hold these capabilities?".

## Applied to

`@Permissions` protects: pieces (create/update/publish/schedule/archive/unarchive/
delete/duplicate/cover), responses, comments (create/reply), claps, bookmarks,
collections (class-level), profile (update/avatar/cover), and admin system
notifications (`notification.manage`, replacing `@Roles(Admin)`). Owner-or-role and
pure-ownership endpoints keep their service-layer checks (docs 13 §4.3).

## Tests

- Unit: factory (wildcards), resolver (rank-stack/fallback/cache), guard, seeder.
- E2E (`test/permissions.e2e-spec.ts`): backward-compat, missing-permission 403,
  role mapping, `piece.*` wildcard, super-admin `*` bypass.
