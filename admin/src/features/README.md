# features/

Feature-first modules for the admin panel — **one directory per admin section**
(mirroring the route map in `docs/00` §10):

```
features/
├── users/            # /users — accounts, suspension, verification
├── pieces/           # /pieces — published-content management
├── reports/          # /reports — moderation queue
├── card-templates/   # /card-templates
├── prompts/          # /prompts — daily prompts
├── languages/        # /languages
├── featured/         # /featured — featured writers
├── analytics/        # /analytics
├── moderators/       # /moderators
├── roles/            # /roles
└── audit-logs/       # /audit-logs
```

Each feature owns its own `api/` (query hooks over `@/lib/api-client`),
`components/`, `hooks/`, and `stores/` as needed. Rules:

- A feature must be deletable with one `rm -rf` — no other feature may import
  from it. Cross-cutting pieces move up to `src/components/` or `@qalam/ui`.
- Server state stays in TanStack Query inside the feature's `api/` hooks —
  never mirrored into Zustand.
- Routes register in `src/app/router.tsx` behind `RequireRole` guards (Phase 1,
  per docs/11).

Empty until Phase 1 — the foundation ships no features.
