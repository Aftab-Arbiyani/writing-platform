# Qalam Frontend — Documentation Index

The Reader/Writer web app (`frontend/`) — React 19 + Vite 7 + AntD 5 + Tailwind 4, consuming the
frozen backend `v1` contract. These guides were produced/finalised in **Epic F10 (Production
Hardening)** and complement the repo-wide architecture volumes in `docs/` (the master ADR is
`docs/00`; frontend specifics live in `docs/26_FrontendArchitecture`, `docs/32_APIIntegration`,
`docs/33_FormValidation`, and the folded guidance across `docs/06–12/16`).

| Guide                                                  | What it covers                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| [01 Architecture Summary](./01_ArchitectureSummary.md) | App shell, feature-first layout, routing, state, data flow            |
| [02 Component Inventory](./02_ComponentInventory.md)   | `@qalam/ui` primitives + shared app components + per-feature surfaces |
| [03 Shared Packages](./03_SharedPackages.md)           | `@qalam/{shared,utils,api-types,ui,config}` boundaries and usage      |
| [04 Environment Setup](./04_EnvironmentSetup.md)       | Prereqs, install, env vars, local run                                 |
| [05 Deployment Guide](./05_Deployment.md)              | Build, static hosting, env, SEO/PWA assets, CI checks                 |
| [06 Performance Guide](./06_Performance.md)            | Code-splitting, bundle budget, query caching, memoisation             |
| [07 Accessibility Guide](./07_Accessibility.md)        | WCAG AA practices, patterns, the audit result, known gaps             |
| [08 Testing Guide](./08_Testing.md)                    | Vitest setup, harness, what to test, coverage snapshot                |

**Production status:** F1–F10 complete. `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
all green (254 tests / 65 files). See `09_FrontendReadinessReport` in the F10 deliverables.
