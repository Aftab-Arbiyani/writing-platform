# Feature Folders

Every product feature lives in its own folder here, feature-first:

```
features/
└── <name>/            # e.g. auth, feed, editor, pieces, search
    ├── api/           # query/mutation hooks built on src/lib/api-client.ts
    ├── components/    # feature-private components (never imported across features)
    ├── hooks/         # feature-private hooks
    ├── stores/        # feature-scoped zustand slices (client state only)
    └── types/         # feature-private types (wire types come from @qalam/api-types)
```

## Rules

- **Deletable in one `rm -rf`** — a feature must not leak into other features.
  Cross-feature needs go through `src/components/` (app-wide composites),
  `@qalam/ui` (primitives), or `src/lib/` (plumbing).
- **Server state** only via TanStack Query hooks in `api/` — never mirrored into
  zustand, never fetched ad-hoc in components.
- **Routes** for a feature register in `src/app/router.tsx` as `lazy()` route groups.
- Filenames are kebab-case; no default exports except route pages.

See `docs/03_FrontendPlan.md` and `docs/12_FrontendArchitecture.md` for the
feature list and layering contract. This folder is intentionally empty until Phase 1.
